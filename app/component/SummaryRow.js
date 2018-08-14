import PropTypes from 'prop-types';
import React from 'react';
import moment from 'moment';
import cx from 'classnames';
import { FormattedMessage, intlShape } from 'react-intl';
import isEqual from 'lodash/isEqual';
import filter from 'lodash/filter';

import { sameDay, dateOrEmpty } from '../util/timeUtils';
import { displayDistance } from '../util/geo-utils';
import RouteNumber from './RouteNumber';
import RouteNumberContainer from './RouteNumberContainer';
import Icon from './Icon';
import RelativeDuration from './RelativeDuration';
import ComponentUsageExample from './ComponentUsageExample';
import {
  getTotalWalkingDistance,
  isCallAgencyPickupType,
  getTotalBikingDistance,
  containsBiking,
  onlyBiking,
} from '../util/legUtils';
import withBreakpoint from '../util/withBreakpoint';

/*
const dummyalerts = [{
  effectiveStartDate: new Date().getTime() - 9000000,
  effectiveEndDate: new Date().getTime() + 9000000,
}];
*/

const hasActiveDisruption = (t1, t2, alerts) =>
  filter(
    alerts,
    alert => !(alert.effectiveStartDate > t2 || alert.effectiveEndDate < t1),
  ).length > 0;

const Leg = ({ routeNumber, leg, large }) => (
  <div className="leg">
    {large && (
      <div className="departure-stop overflow-fade">
        &nbsp;{(leg.transitLeg || leg.rentedBike) && leg.from.name}
      </div>
    )}
    {routeNumber}
  </div>
);

Leg.propTypes = {
  routeNumber: PropTypes.node.isRequired,
  leg: PropTypes.object.isRequired,
  large: PropTypes.bool.isRequired,
};

const RouteLeg = ({ leg, large, intl }) => {
  const isCallAgency = isCallAgencyPickupType(leg);

  let routeNumber;
  if (isCallAgency) {
    const message = intl.formatMessage({
      id: 'pay-attention',
      defaultMessage: 'Pay Attention',
    });
    routeNumber = (
      <RouteNumber
        mode="call"
        text={message}
        className={cx('line', 'call')}
        vertical
        withBar
      />
    );
  } else {
    routeNumber = (
      <RouteNumberContainer
        route={leg.route}
        className={cx('line', leg.mode.toLowerCase())}
        vertical
        withBar
        hasDisruption={hasActiveDisruption(
          leg.startTime / 1000,
          leg.endTime / 1000,
          leg.route.alerts,
          // dummyalerts,
        )}
      />
    );
  }

  return <Leg leg={leg} routeNumber={routeNumber} large={large} />;
};

RouteLeg.propTypes = {
  leg: PropTypes.object.isRequired,
  intl: intlShape.isRequired,
  large: PropTypes.bool.isRequired,
};

export const ModeLeg = ({ leg, mode, large }) => {
  const routeNumber = (
    <RouteNumber
      mode={mode}
      text=""
      className={cx('line', mode.toLowerCase())}
      vertical
      withBar
    />
  );
  return <Leg leg={leg} routeNumber={routeNumber} large={large} />;
};

ModeLeg.propTypes = {
  leg: PropTypes.object.isRequired,
  mode: PropTypes.string.isRequired,
  large: PropTypes.bool.isRequired,
};

const CityBikeLeg = ({ leg, large }) => (
  <ModeLeg leg={leg} mode="CITYBIKE" large={large} />
);

CityBikeLeg.propTypes = {
  leg: PropTypes.object.isRequired,
  large: PropTypes.bool.isRequired,
};

export const ViaLeg = () => (
  <div className="leg via">
    <Icon img="icon-icon_place" className="itinerary-icon place" />
  </div>
);

/**
 * The relative duration of a leg that, if not met, may result in the leg being
 * discarded from the top level summary view.
 */
const LEG_DURATION_THRESHOLD = 0.025;

/**
 * Checks that the given leg's duration is big enough to be considered for
 * showing in the top level summary view.
 *
 * @param {number} totalDuration The total duration of the itinerary
 * @param {*} leg The leg to check the threshold for
 */
const checkRelativeDurationThreshold = (totalDuration, leg) =>
  moment(leg.endTime).diff(moment(leg.startTime)) / totalDuration >
  LEG_DURATION_THRESHOLD;

const SummaryRow = (
  { data, breakpoint, ...props },
  { intl, intl: { formatMessage }, config },
) => {
  const refTime = moment(props.refTime);
  const startTime = moment(data.startTime);
  const endTime = moment(data.endTime);
  const duration = endTime.diff(startTime);
  const legs = [];
  let realTimeAvailable = false;
  let noTransitLegs = true;

  data.legs.forEach(leg => {
    if (leg.transitLeg || leg.rentedBike) {
      if (noTransitLegs && leg.realTime) {
        realTimeAvailable = true;
      }
      noTransitLegs = false;
    }
  });

  let lastLegRented = false;

  data.legs.forEach(leg => {
    if (leg.rentedBike && lastLegRented) {
      return;
    }
    const isThresholdMet = checkRelativeDurationThreshold(duration, leg);
    if (!leg.intermediatePlace && !isThresholdMet && !leg.rentedBike) {
      return;
    }

    lastLegRented = leg.rentedBike;

    if (
      leg.transitLeg ||
      leg.rentedBike ||
      noTransitLegs ||
      leg.intermediatePlace
    ) {
      if (leg.rentedBike) {
        legs.push(
          <ModeLeg
            key={`${leg.mode}_${leg.startTime}`}
            leg={leg}
            mode="CITYBIKE"
            large={breakpoint === 'large'}
          />,
        );
      } else if (leg.intermediatePlace) {
        legs.push(<ViaLeg key={`via_${leg.mode}_${leg.startTime}`} />);
        if (noTransitLegs && isThresholdMet) {
          legs.push(
            <ModeLeg
              key={`${leg.mode}_${leg.startTime}`}
              leg={leg}
              mode={leg.mode}
              large={breakpoint === 'large'}
            />,
          );
        }
      } else if (leg.route) {
        if (
          props.intermediatePlaces &&
          props.intermediatePlaces.length > 0 &&
          isEqual(
            [leg.from.lat, leg.from.lon],
            [props.intermediatePlaces[0].lat, props.intermediatePlaces[0].lon],
          )
        ) {
          legs.push(<ViaLeg key={`via_${leg.mode}_${leg.startTime}`} />);
        }
        legs.push(
          <RouteLeg
            key={`${leg.mode}_${leg.startTime}`}
            leg={leg}
            intl={intl}
            large={breakpoint === 'large'}
          />,
        );
      } else {
        legs.push(
          <ModeLeg
            key={`${leg.mode}_${leg.startTime}`}
            leg={leg}
            mode={leg.mode}
            large={breakpoint === 'large'}
          />,
        );
      }
    }
  });

  let firstLegStartTime = null;

  if (!noTransitLegs) {
    let firstDeparture = false;
    if (
      data.legs[1] != null &&
      !(data.legs[1].rentedBike || data.legs[0].transitLeg)
    ) {
      firstDeparture = data.legs[1].startTime;
    }
    if (data.legs[0].transitLeg && !data.legs[0].rentedBike) {
      firstDeparture = data.legs[0].startTime;
    }
    if (firstDeparture) {
      firstLegStartTime = (
        <div
          className={cx('itinerary-first-leg-start-time', {
            realtime: realTimeAvailable,
          })}
        >
          {realTimeAvailable && (
            <Icon img="icon-icon_realtime" className="realtime-icon realtime" />
          )}
          {moment(firstDeparture).format('HH:mm')}
        </div>
      );
    }
  }

  const classes = cx([
    'itinerary-summary-row',
    'cursor-pointer',
    {
      passive: props.passive,
      'bp-large': breakpoint === 'large',
      open: props.open || props.children,
    },
  ]);

  const itineraryLabel = formatMessage({
    id: 'itinerary-page.title',
    defaultMessage: 'Itinerary',
  });

  const isDefaultPosition = breakpoint !== 'large' && !onlyBiking(data);
  const renderBikingDistance = itinerary =>
    containsBiking(itinerary) && (
      <div className="itinerary-biking-distance">
        <Icon img="icon-icon_biking" viewBox="0 0 40 40" />
        {displayDistance(getTotalBikingDistance(itinerary), config)}
      </div>
    );

  /* eslint-disable jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
  return (
    <div className={classes} onClick={() => props.onSelect(props.hash)}>
      {props.open || props.children
        ? [
            <div className="flex-grow itinerary-heading" key="title">
              <FormattedMessage
                id="itinerary-page.title"
                defaultMessage="Itinerary"
                tagName="h2"
              />
            </div>,
            <button
              title={itineraryLabel}
              key="arrow"
              className="action-arrow-click-area noborder flex-vertical"
              onClick={e => {
                e.stopPropagation();
                props.onSelectImmediately(props.hash);
              }}
            >
              <div className="action-arrow flex-grow">
                <Icon img="icon-icon_arrow-collapse--right" />
              </div>
            </button>,
            props.children &&
              React.cloneElement(React.Children.only(props.children), {
                searchTime: props.refTime,
              }),
          ]
        : [
            <div className="itinerary-start-time" key="startTime">
              <span
                className={cx('itinerary-start-date', {
                  nobg: sameDay(startTime, refTime),
                })}
              >
                <span>{dateOrEmpty(startTime, refTime)}</span>
              </span>
              {startTime.format('HH:mm')}
              {firstLegStartTime}
            </div>,
            <div className="itinerary-legs" key="legs">
              {legs}
            </div>,
            <div
              className="itinerary-end-time-and-distance"
              key="endtime-distance"
            >
              <div className="itinerary-end-time">
                {endTime.format('HH:mm')}
              </div>
              {isDefaultPosition && renderBikingDistance(data)}
            </div>,
            <div
              className="itinerary-duration-and-distance"
              key="duration-distance"
            >
              <span className="itinerary-duration">
                <RelativeDuration duration={duration} />
              </span>
              {!isDefaultPosition && renderBikingDistance(data)}
              {!onlyBiking(data) && (
                <div className="itinerary-walking-distance">
                  <Icon img="icon-icon_walk" viewBox="6 0 40 40" />
                  {displayDistance(getTotalWalkingDistance(data), config)}
                </div>
              )}
            </div>,
            <button
              title={itineraryLabel}
              key="arrow"
              className="action-arrow-click-area flex-vertical noborder"
              onClick={e => {
                e.stopPropagation();
                props.onSelectImmediately(props.hash);
              }}
            >
              <div className="action-arrow flex-grow">
                <Icon img="icon-icon_arrow-collapse--right" />
              </div>
            </button>,
          ]}
    </div>
  );
};

SummaryRow.propTypes = {
  refTime: PropTypes.number.isRequired,
  data: PropTypes.object.isRequired,
  passive: PropTypes.bool,
  onSelect: PropTypes.func.isRequired,
  onSelectImmediately: PropTypes.func.isRequired,
  hash: PropTypes.number.isRequired,
  children: PropTypes.node,
  open: PropTypes.bool,
  breakpoint: PropTypes.string.isRequired,
  intermediatePlaces: PropTypes.array,
};

SummaryRow.contextTypes = {
  intl: intlShape.isRequired,
  config: PropTypes.object.isRequired,
};

SummaryRow.displayName = 'SummaryRow';

const exampleData = t1 => ({
  startTime: t1,
  endTime: t1 + 10000,
  walkDistance: 770,
  legs: [
    {
      realTime: false,
      transitLeg: false,
      startTime: t1 + 10000,
      endTime: t1 + 20000,
      mode: 'WALK',
      distance: 483.84600000000006,
      duration: 438,
      rentedBike: false,
      route: null,
      from: { name: 'Messuaukio 1, Helsinki' },
    },
    {
      realTime: false,
      transitLeg: true,
      startTime: t1 + 20000,
      endTime: t1 + 30000,
      mode: 'BUS',
      distance: 586.4621425755712,
      duration: 120,
      rentedBike: false,
      route: { shortName: '57', mode: 'BUS' },
      from: { name: 'Ilmattarentie' },
    },
    {
      realTime: false,
      transitLeg: false,
      startTime: t1 + 30000,
      endTime: t1 + 40000,
      mode: 'WALK',
      distance: 291.098,
      duration: 259,
      rentedBike: false,
      route: null,
      from: { name: 'Veturitie' },
    },
  ],
});

const exampleDataVia = t1 => ({
  startTime: t1,
  endTime: t1 + 10000,
  walkDistance: 770,
  legs: [
    {
      realTime: false,
      transitLeg: false,
      startTime: t1 + 10000,
      endTime: t1 + 20000,
      mode: 'WALK',
      distance: 200,
      duration: 438,
      rentedBike: false,
      route: null,
      from: { name: 'Messuaukio 1, Helsinki' },
    },
    {
      realTime: false,
      transitLeg: true,
      startTime: t1 + 20000,
      endTime: t1 + 30000,
      mode: 'BUS',
      distance: 586.4621425755712,
      duration: 120,
      rentedBike: false,
      route: { shortName: '57', mode: 'BUS' },
      from: { name: 'Ilmattarentie' },
    },
    {
      realTime: false,
      transitLeg: true,
      startTime: t1 + 30000,
      endTime: t1 + 40000,
      mode: 'WALK',
      intermediatePlace: true,
      distance: 400,
      duration: 600,
      rentedBike: false,
      route: null,
      from: { name: 'Ilmattarentie' },
    },
    {
      realTime: false,
      transitLeg: true,
      startTime: t1 + 40000,
      endTime: t1 + 50000,
      mode: 'BUS',
      distance: 586.4621425755712,
      duration: 120,
      rentedBike: false,
      route: { shortName: '57', mode: 'BUS' },
      from: { name: 'Messuaukio 1, Helsinki' },
    },
    {
      realTime: false,
      transitLeg: false,
      startTime: t1 + 50000,
      endTime: t1 + 60000,
      mode: 'WALK',
      distance: 170,
      duration: 259,
      rentedBike: false,
      route: null,
      from: { name: 'Messuaukio 1, Helsinki' },
    },
  ],
});

const exampleDataCallAgency = t1 => ({
  startTime: t1,
  endTime: t1 + 10000,
  walkDistance: 770,
  legs: [
    {
      realTime: false,
      transitLeg: false,
      startTime: t1 + 10000,
      endTime: t1 + 20000,
      mode: 'WALK',
      distance: 483.84600000000006,
      duration: 438,
      rentedBike: false,
      route: null,
      from: { name: 'Messuaukio 1, Helsinki' },
    },
    {
      realTime: false,
      transitLeg: true,
      startTime: t1 + 20000,
      endTime: t1 + 30000,
      mode: 'BUS',
      distance: 586.4621425755712,
      duration: 120,
      rentedBike: false,
      route: { shortName: '57', mode: 'BUS' },
      from: { name: 'Ilmattarentie', stop: { gtfsId: 'start' } },
      to: { name: 'Joku Pysäkki', stop: { gtfsId: 'end' } },
      trip: {
        stoptimes: [
          {
            pickupType: 'CALL_AGENCY',
            stop: { gtfsId: 'start' },
          },
        ],
      },
    },
    {
      realTime: false,
      transitLeg: false,
      startTime: t1 + 30000,
      endTime: t1 + 40000,
      mode: 'WALK',
      distance: 291.098,
      duration: 259,
      rentedBike: false,
      route: null,
      from: { name: 'Veturitie' },
    },
  ],
});

const exampleDataBiking = t1 => ({
  startTime: t1,
  endTime: t1 + 1080000,
  walkDistance: 770,
  legs: [
    {
      realTime: false,
      transitLeg: false,
      startTime: t1 + 10000,
      endTime: t1 + 20000,
      mode: 'WALK',
      distance: 483.84600000000006,
      duration: 438,
      rentedBike: false,
      route: null,
      from: { name: 'Messuaukio 1, Helsinki' },
    },
    {
      realTime: false,
      transitLeg: false,
      startTime: t1 + 20000,
      endTime: t1 + 30000,
      mode: 'BICYCLE',
      distance: 586.4621425755712,
      duration: 120,
      rentedBike: false,
      route: null,
      from: { name: 'Ilmattarentie' },
    },
    {
      realTime: false,
      transitLeg: false,
      startTime: t1 + 30000,
      endTime: t1 + 40000,
      mode: 'WALK',
      distance: 291.098,
      duration: 259,
      rentedBike: false,
      route: null,
      from: { name: 'Veturitie' },
    },
  ],
});

const nop = () => {};

SummaryRow.description = () => {
  const today = moment()
    .hour(12)
    .minute(34)
    .second(0)
    .valueOf();
  const date = 1478611781000;
  return (
    <div>
      <p>Displays a summary of an itinerary.</p>
      <ComponentUsageExample description="passive-small-today">
        <SummaryRow
          refTime={today}
          breakpoint="small"
          data={exampleData(today)}
          passive
          onSelect={nop}
          onSelectImmediately={nop}
          hash={1}
        />
      </ComponentUsageExample>
      <ComponentUsageExample description="active-small-today">
        <SummaryRow
          refTime={today}
          breakpoint="small"
          data={exampleData(today)}
          onSelect={nop}
          onSelectImmediately={nop}
          hash={1}
        />
      </ComponentUsageExample>
      <ComponentUsageExample description="passive-large-today">
        <SummaryRow
          refTime={today}
          breakpoint="large"
          data={exampleData(today)}
          passive
          onSelect={nop}
          onSelectImmediately={nop}
          hash={1}
        />
      </ComponentUsageExample>
      <ComponentUsageExample description="active-large-today">
        <SummaryRow
          refTime={today}
          breakpoint="large"
          data={exampleData(today)}
          onSelect={nop}
          onSelectImmediately={nop}
          hash={1}
        />
      </ComponentUsageExample>
      <ComponentUsageExample description="passive-small-tomorrow">
        <SummaryRow
          refTime={today}
          breakpoint="small"
          data={exampleData(date)}
          passive
          onSelect={nop}
          onSelectImmediately={nop}
          hash={1}
        />
      </ComponentUsageExample>
      <ComponentUsageExample description="active-small-tomorrow">
        <SummaryRow
          refTime={today}
          breakpoint="small"
          data={exampleData(date)}
          onSelect={nop}
          onSelectImmediately={nop}
          hash={1}
        />
      </ComponentUsageExample>
      <ComponentUsageExample description="passive-large-tomorrow">
        <SummaryRow
          refTime={today}
          breakpoint="large"
          data={exampleData(date)}
          passive
          onSelect={nop}
          onSelectImmediately={nop}
          hash={1}
        />
      </ComponentUsageExample>
      <ComponentUsageExample description="active-large-tomorrow">
        <SummaryRow
          refTime={today}
          breakpoint="large"
          data={exampleData(date)}
          onSelect={nop}
          onSelectImmediately={nop}
          hash={1}
        />
      </ComponentUsageExample>
      <ComponentUsageExample description="open-large-today">
        <SummaryRow
          refTime={today}
          breakpoint="large"
          data={exampleData(today)}
          onSelect={nop}
          onSelectImmediately={nop}
          hash={1}
          open
        />
      </ComponentUsageExample>
      <ComponentUsageExample description="open-large-tomorrow">
        <SummaryRow
          refTime={today}
          breakpoint="large"
          data={exampleData(date)}
          onSelect={nop}
          onSelectImmediately={nop}
          hash={1}
          open
        />
      </ComponentUsageExample>
      <ComponentUsageExample description="passive-small-via">
        <SummaryRow
          refTime={today}
          breakpoint="small"
          data={exampleDataVia(today)}
          passive
          onSelect={nop}
          onSelectImmediately={nop}
          hash={1}
        />
      </ComponentUsageExample>
      <ComponentUsageExample description="active-large-via">
        <SummaryRow
          refTime={today}
          breakpoint="large"
          data={exampleDataVia(today)}
          onSelect={nop}
          onSelectImmediately={nop}
          hash={1}
        />
      </ComponentUsageExample>
      <ComponentUsageExample description="passive-small-call-agency">
        <SummaryRow
          refTime={today}
          breakpoint="small"
          data={exampleDataCallAgency(today)}
          passive
          onSelect={nop}
          onSelectImmediately={nop}
          hash={1}
        />
      </ComponentUsageExample>
      <ComponentUsageExample description="active-large-call-agency">
        <SummaryRow
          refTime={today}
          breakpoint="large"
          data={exampleDataCallAgency(today)}
          onSelect={nop}
          onSelectImmediately={nop}
          hash={1}
        />
      </ComponentUsageExample>
      <ComponentUsageExample description="passive-large-biking">
        <SummaryRow
          refTime={today}
          breakpoint="large"
          data={exampleDataBiking(today)}
          passive
          onSelect={nop}
          onSelectImmediately={nop}
          hash={1}
        />
      </ComponentUsageExample>
      <ComponentUsageExample description="passive-small-biking">
        <SummaryRow
          refTime={today}
          breakpoint="small"
          data={exampleDataBiking(today)}
          passive
          onSelect={nop}
          onSelectImmediately={nop}
          hash={1}
        />
      </ComponentUsageExample>
    </div>
  );
};

const SummaryRowWithBreakpoint = withBreakpoint(SummaryRow);

export { SummaryRow as component, SummaryRowWithBreakpoint as default };
