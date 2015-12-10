React          = require 'react'
ReactAutosuggest = require 'react-autosuggest'
Icon           = require '../icon/icon'
XhrPromise     = require '../../util/xhr-promise.coffee'
config         = require '../../config'
sortBy         = require 'lodash/collection/sortBy'

AUTOSUGGEST_ID = 'autosuggest'

class Autosuggest extends React.Component
  @contextTypes:
    executeAction: React.PropTypes.func.isRequired

  getNumberIfNotZero: (number) ->
    if number and not (number is "0") then " #{number}" else ""

  getLocality: (suggestion) ->
    if suggestion.locality
      suggestion.locality
    else ""

  getName: (suggestion) ->
    switch suggestion.layer
      when 'address'
        "#{suggestion.street}#{@getNumberIfNotZero suggestion.housenumber}, #{@getLocality suggestion}"
      when 'locality'
        "#{suggestion.name}, #{@getLocality suggestion}"
      when 'neighbourhood'
        "#{suggestion.name}, #{@getLocality suggestion}"
      when 'venue'
        "#{suggestion.name}, #{@getLocality suggestion}"
      else
        "#{suggestion.label}"

  getIcon: (layer) ->
    switch layer
      when 'address'
        <Icon img="icon-icon_place"/>
      when 'stop'
        <Icon img="icon-icon_bus-stop"/>
      when 'locality'
        <Icon img="icon-icon_city"/>
      when 'station'
        <Icon img="icon-icon_station"/>
      when 'localadmin'
        <Icon img="icon-icon_city"/>
      when 'neighbourhood'
        <Icon img="icon-icon_city"/>
      else
        <Icon img="icon-icon_place"/>

  getSuggestions: (input, callback) =>
    opts = Object.assign(text: input, config.searchParams)

    XhrPromise.getJson(config.URL.PELIAS, opts).then (res) ->
      features = res.features

      if config.autoSuggest?
        features = sortBy(features,
          (feature) ->
            config.autoSuggest.sortOrder[feature.properties.layer] || config.autoSuggest.sortOther
          )
      callback null, features

  renderSuggestions: (suggestion, input) =>
    displayText = @getName suggestion.properties
    return <span id={displayText}>
        {@getIcon suggestion.properties.layer}
        {displayText}
      </span>

  componentDidMount: =>
    if @refs.input.refs.input.value == ""
      @refs.input.refs.input.focus()

  suggestionValue: (suggestion) =>
    @getName suggestion.properties

  onSuggestionSelected: (suggestion, event) =>
    @context.executeAction @props.onSelectionAction,
      lat: suggestion.geometry.coordinates[1]
      lon: suggestion.geometry.coordinates[0],
      address: @getName suggestion.properties

  # Happens when user presses enter without selecting anything from autosuggest
  onSubmit: (e) =>
    @getSuggestions @refs.input.state.value, (err, values) => @onSuggestionSelected values[0], e
    e.preventDefault()

  render: =>
    inputAttributes =
      placeholder: @props.placeholder
      onBlur: @props.disableInput

    <form onSubmit={@onSubmit}>
      <ReactAutosuggest
        ref="input"
        suggestions={@getSuggestions}
        suggestionRenderer={@renderSuggestions}
        suggestionValue={@suggestionValue}
        defaultValue={@props.value}
        showWhen={(input) =>
          # This a dirty hack to do two things:
          # 1) we start showing results after 2 characters (this one is ok)
          # 2) when we notice that everything is cleared, we remove location from flux store (not ok)
          # react-autosuggest should support second case, but it currently doesn't
          if input == ""
            @props.onEmptyAction()
          input.trim().length >= 2
        }
        onSuggestionSelected={@onSuggestionSelected}
        inputAttributes = {inputAttributes}
        id={@props.id}
        scrollBar={true}
      />
    </form>

module.exports = Autosuggest
