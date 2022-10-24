/*! @name videojs-contrib-dash @version 5.1.2 @license Apache-2.0 */
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('dashjs'), require('video.js'), require('global/window'), require('global/document')) :
  typeof define === 'function' && define.amd ? define(['dashjs', 'video.js', 'global/window', 'global/document'], factory) :
  (global.videojsDash = factory(global.dashjs,global.videojs,global.window,global.document));
}(this, (function (dashjs,videojs,window,document) { 'use strict';

  dashjs = dashjs && dashjs.hasOwnProperty('default') ? dashjs['default'] : dashjs;
  videojs = videojs && videojs.hasOwnProperty('default') ? videojs['default'] : videojs;
  window = window && window.hasOwnProperty('default') ? window['default'] : window;
  document = document && document.hasOwnProperty('default') ? document['default'] : document;

  /**
   * Setup audio tracks. Take the tracks from dash and add the tracks to videojs. Listen for when
   * videojs changes tracks and apply that to the dash player because videojs doesn't do this
   * natively.
   *
   * @private
   * @param {videojs} player the videojs player instance
   * @param {videojs.tech} tech the videojs tech being used
   */

  function handlePlaybackMetadataLoaded(player, tech) {
    var mediaPlayer = player.dash.mediaPlayer;
    var dashAudioTracks = mediaPlayer.getTracksFor('audio');
    var videojsAudioTracks = player.audioTracks();

    function generateIdFromTrackIndex(index) {
      return "dash-audio-" + index;
    }

    function findDashAudioTrack(subDashAudioTracks, videojsAudioTrack) {
      return subDashAudioTracks.find(function (_ref) {
        var index = _ref.index;
        return generateIdFromTrackIndex(index) === videojsAudioTrack.id;
      });
    } // Safari creates a single native `AudioTrack` (not `videojs.AudioTrack`) when loading. Clear all
    // automatically generated audio tracks so we can create them all ourself.


    if (videojsAudioTracks.length) {
      tech.clearTracks(['audio']);
    }

    var currentAudioTrack = mediaPlayer.getCurrentTrackFor('audio');
    dashAudioTracks.forEach(function (dashTrack) {
      var localizedLabel;

      if (Array.isArray(dashTrack.labels)) {
        for (var i = 0; i < dashTrack.labels.length; i++) {
          if (dashTrack.labels[i].lang && player.language().indexOf(dashTrack.labels[i].lang.toLowerCase()) !== -1) {
            localizedLabel = dashTrack.labels[i];
            break;
          }
        }
      }

      var label;

      if (localizedLabel) {
        label = localizedLabel.text;
      } else if (Array.isArray(dashTrack.labels) && dashTrack.labels.length === 1) {
        label = dashTrack.labels[0].text;
      } else {
        label = dashTrack.lang;

        if (dashTrack.roles && dashTrack.roles.length) {
          label += ' (' + dashTrack.roles.join(', ') + ')';
        }
      } // Add the track to the player's audio track list.


      videojsAudioTracks.addTrack(new videojs.AudioTrack({
        enabled: dashTrack === currentAudioTrack,
        id: generateIdFromTrackIndex(dashTrack.index),
        kind: dashTrack.kind || 'main',
        label: label,
        language: dashTrack.lang
      }));
    });

    var audioTracksChangeHandler = function audioTracksChangeHandler() {
      for (var i = 0; i < videojsAudioTracks.length; i++) {
        var track = videojsAudioTracks[i];

        if (track.enabled) {
          // Find the audio track we just selected by the id
          var dashAudioTrack = findDashAudioTrack(dashAudioTracks, track); // Set is as the current track

          mediaPlayer.setCurrentTrack(dashAudioTrack); // Stop looping

          continue;
        }
      }
    };

    videojsAudioTracks.addEventListener('change', audioTracksChangeHandler);
    player.dash.mediaPlayer.on(dashjs.MediaPlayer.events.STREAM_TEARDOWN_COMPLETE, function () {
      videojsAudioTracks.removeEventListener('change', audioTracksChangeHandler);
    });
  }
  /*
   * Call `handlePlaybackMetadataLoaded` when `mediaPlayer` emits
   * `dashjs.MediaPlayer.events.PLAYBACK_METADATA_LOADED`.
   */


  function setupAudioTracks(player, tech) {
    // When `dashjs` finishes loading metadata, create audio tracks for `video.js`.
    player.dash.mediaPlayer.on(dashjs.MediaPlayer.events.PLAYBACK_METADATA_LOADED, handlePlaybackMetadataLoaded.bind(null, player, tech));
  }

  function find(l, f) {
    for (var i = 0; i < l.length; i++) {
      if (f(l[i])) {
        return l[i];
      }
    }
  }
  /*
   * Attach text tracks from dash.js to videojs
   *
   * @param {videojs} player the videojs player instance
   * @param {array} tracks the tracks loaded by dash.js to attach to videojs
   *
   * @private
   */


  function attachDashTextTracksToVideojs(player, tech, tracks) {
    var trackDictionary = []; // Add remote tracks

    var tracksAttached = tracks // Map input data to match HTMLTrackElement spec
    // https://developer.mozilla.org/en-US/docs/Web/API/HTMLTrackElement
    .map(function (track) {
      var localizedLabel;

      if (Array.isArray(track.labels)) {
        for (var i = 0; i < track.labels.length; i++) {
          if (track.labels[i].lang && player.language().indexOf(track.labels[i].lang.toLowerCase()) !== -1) {
            localizedLabel = track.labels[i];
            break;
          }
        }
      }

      var label;

      if (localizedLabel) {
        label = localizedLabel.text;
      } else if (Array.isArray(track.labels) && track.labels.length === 1) {
        label = track.labels[0].text;
      } else {
        label = track.lang || track.label;
      }

      return {
        dashTrack: track,
        trackConfig: {
          label: label,
          language: track.lang,
          srclang: track.lang,
          kind: track.kind
        }
      };
    }) // Add track to videojs track list
    .map(function (_ref) {
      var trackConfig = _ref.trackConfig,
          dashTrack = _ref.dashTrack;

      if (dashTrack.isTTML && !player.getChild('TTMLTextTrackDisplay')) {
        return null;
      }

      var remoteTextTrack = player.addRemoteTextTrack(trackConfig, false);
      trackDictionary.push({
        textTrack: remoteTextTrack.track,
        dashTrack: dashTrack
      }); // Don't add the cues becuase we're going to let dash handle it natively. This will ensure
      // that dash handle external time text files and fragmented text tracks.
      //
      // Example file with external time text files:
      // https://storage.googleapis.com/shaka-demo-assets/sintel-mp4-wvtt/dash.mpd

      return remoteTextTrack;
    }).filter(function (el) {
      return el !== null;
    });
    /*
     * Scan `videojs.textTracks()` to find one that is showing. Set the dash text track.
     */

    function updateActiveDashTextTrack() {
      var dashMediaPlayer = player.dash.mediaPlayer;
      var textTracks = player.textTracks();
      var activeTextTrackIndex = -1; // Iterate through the tracks and find the one marked as showing. If none are showing,
      // `activeTextTrackIndex` will be set to `-1`, disabling text tracks.

      var _loop = function _loop(i) {
        var textTrack = textTracks[i];

        if (textTrack.mode === 'showing') {
          // Find the dash track we want to use

          /* jshint loopfunc: true */
          var dictionaryLookupResult = find(trackDictionary, function (track) {
            return track.textTrack === textTrack;
          });
          /* jshint loopfunc: false */

          var dashTrackToActivate = dictionaryLookupResult ? dictionaryLookupResult.dashTrack : null; // If we found a track, get it's index.

          if (dashTrackToActivate) {
            activeTextTrackIndex = tracks.indexOf(dashTrackToActivate);
          }
        }
      };

      for (var i = 0; i < textTracks.length; i += 1) {
        _loop(i);
      } // If the text track has changed, then set it in dash


      if (activeTextTrackIndex !== dashMediaPlayer.getCurrentTextTrackIndex()) {
        dashMediaPlayer.setTextTrack(activeTextTrackIndex);
      }
    } // Update dash when videojs's selected text track changes.


    player.textTracks().on('change', updateActiveDashTextTrack); // Cleanup event listeners whenever we start loading a new source

    player.dash.mediaPlayer.on(dashjs.MediaPlayer.events.STREAM_TEARDOWN_COMPLETE, function () {
      player.textTracks().off('change', updateActiveDashTextTrack);
    }); // Initialize the text track on our first run-through

    updateActiveDashTextTrack();
    return tracksAttached;
  }
  /*
   * Wait for dash to emit `TEXT_TRACKS_ADDED` and then attach the text tracks loaded by dash if
   * we're not using native text tracks.
   *
   * @param {videojs} player the videojs player instance
   * @private
   */


  function setupTextTracks(player, tech, options) {
    // Clear VTTCue if it was shimmed by vttjs and let dash.js use TextTrackCue.
    // This is necessary because dash.js creates text tracks
    // using addTextTrack which is incompatible with vttjs.VTTCue in IE11
    if (window.VTTCue && !/\[native code\]/.test(window.VTTCue.toString())) {
      window.VTTCue = false;
    } // Store the tracks that we've added so we can remove them later.


    var dashTracksAttachedToVideoJs = []; // We're relying on the user to disable native captions. Show an error if they didn't do so.

    if (tech.featuresNativeTextTracks) {
      videojs.log.error('You must pass {html: {nativeCaptions: false}} in the videojs constructor ' + 'to use text tracks in videojs-contrib-dash');
      return;
    }

    var mediaPlayer = player.dash.mediaPlayer; // Clear the tracks that we added. We don't clear them all because someone else can add tracks.

    function clearDashTracks() {
      dashTracksAttachedToVideoJs.forEach(player.removeRemoteTextTrack.bind(player));
      dashTracksAttachedToVideoJs = [];
    }

    function handleTextTracksAdded(_ref2) {
      var index = _ref2.index,
          tracks = _ref2.tracks;
      // Stop listening for this event. We only want to hear it once.
      mediaPlayer.off(dashjs.MediaPlayer.events.TEXT_TRACKS_ADDED, handleTextTracksAdded); // Cleanup old tracks

      clearDashTracks();

      if (!tracks.length) {
        // Don't try to add text tracks if there aren't any
        return;
      } // Save the tracks so we can remove them later


      dashTracksAttachedToVideoJs = attachDashTextTracksToVideojs(player, tech, tracks, options);
    } // Attach dash text tracks whenever we dash emits `TEXT_TRACKS_ADDED`.


    mediaPlayer.on(dashjs.MediaPlayer.events.TEXT_TRACKS_ADDED, handleTextTracksAdded); // When the player can play, remove the initialization events. We might not have received
    // TEXT_TRACKS_ADDED` so we have to stop listening for it or we'll get errors when we load new
    // videos and are listening for the same event in multiple places, including cleaned up
    // mediaPlayers.

    mediaPlayer.on(dashjs.MediaPlayer.events.CAN_PLAY, function () {
      mediaPlayer.off(dashjs.MediaPlayer.events.TEXT_TRACKS_ADDED, handleTextTracksAdded);
    });
  }

  function _inheritsLoose(subClass, superClass) {
    subClass.prototype = Object.create(superClass.prototype);
    subClass.prototype.constructor = subClass;

    _setPrototypeOf(subClass, superClass);
  }

  function _setPrototypeOf(o, p) {
    _setPrototypeOf = Object.setPrototypeOf || function _setPrototypeOf(o, p) {
      o.__proto__ = p;
      return o;
    };

    return _setPrototypeOf(o, p);
  }

  function _assertThisInitialized(self) {
    if (self === void 0) {
      throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
    }

    return self;
  }

  var Component = videojs.getComponent('Component');
  var darkGray = '#222';
  var lightGray = '#ccc';
  var fontMap = {
    monospace: 'monospace',
    sansSerif: 'sans-serif',
    serif: 'serif',
    monospaceSansSerif: '"Andale Mono", "Lucida Console", monospace',
    monospaceSerif: '"Courier New", monospace',
    proportionalSansSerif: 'sans-serif',
    proportionalSerif: 'serif',
    casual: '"Comic Sans MS", Impact, fantasy',
    script: '"Monotype Corsiva", cursive',
    smallcaps: '"Andale Mono", "Lucida Console", monospace, sans-serif'
  };
  /**
   * Try to update the style of a DOM element. Some style changes will throw an error,
   * particularly in IE8. Those should be noops.
   *
   * @param {Element} el
   *        The DOM element to be styled.
   *
   * @param {string} style
   *        The CSS property on the element that should be styled.
   *
   * @param {string} rule
   *        The style rule that should be applied to the property.
   *
   * @private
   */

  function tryUpdateStyle(el, style, rule) {
    try {
      el.style[style] = rule;
    } catch (e) {
      // Satisfies linter.
      return;
    }
  }

  function removeStyle(el) {
    if (el.style) {
      el.style.left = null;
      el.style.width = '100%';
    }

    for (var i in el.children) {
      removeStyle(el.children[i]);
    }
  }
  /**
   * Construct an rgba color from a given hex color code.
   *
   * @param {number} color
   *        Hex number for color, like #f0e or #f604e2.
   *
   * @param {number} opacity
   *        Value for opacity, 0.0 - 1.0.
   *
   * @return {string}
   *         The rgba color that was created, like 'rgba(255, 0, 0, 0.3)'.
   */


  function constructColor(color, opacity) {
    var hex;

    if (color.length === 4) {
      // color looks like "#f0e"
      hex = color[1] + color[1] + color[2] + color[2] + color[3] + color[3];
    } else if (color.length === 7) {
      // color looks like "#f604e2"
      hex = color.slice(1);
    } else {
      throw new Error('Invalid color code provided, ' + color + '; must be formatted as e.g. #f0e or #f604e2.');
    }

    return 'rgba(' + parseInt(hex.slice(0, 2), 16) + ',' + parseInt(hex.slice(2, 4), 16) + ',' + parseInt(hex.slice(4, 6), 16) + ',' + opacity + ')';
  }
  /**
   * The component for displaying text track cues.
   *
   * @extends Component
   */

  var TTMLTextTrackDisplay = /*#__PURE__*/function (_Component) {
    _inheritsLoose(TTMLTextTrackDisplay, _Component);

    /**
     * Creates an instance of this class.
     *
     * @param {Player} player
     *        The `Player` that this class should be attached to.
     *
     * @param {Object} [options]
     *        The key/value store of player options.
     *
     * @param {Component~ReadyCallback} [ready]
     *        The function to call when `TextTrackDisplay` is ready.
     */
    function TTMLTextTrackDisplay(player, options, ready) {
      var _this;

      _this = _Component.call(this, player, videojs.mergeOptions(options, {
        playerOptions: {}
      }), ready) || this;
      var selects = player.getChild('TextTrackSettings').$$('select');

      for (var i = 0; i < selects.length; i++) {
        _this.on(selects[i], 'change', _this.updateStyle.bind(_assertThisInitialized(_this)));
      }

      player.dash.mediaPlayer.on(dashjs.MediaPlayer.events.CAPTION_RENDERED, _this.updateStyle.bind(_assertThisInitialized(_this)));
      return _this;
    }
    /**
     * Create the {@link Component}'s DOM element.
     *
     * @return {Element}
     *         The element that was created.
     */


    var _proto = TTMLTextTrackDisplay.prototype;

    _proto.createEl = function createEl() {
      var newEl = _Component.prototype.createEl.call(this, 'div', {
        className: 'vjs-text-track-display-ttml'
      }, {
        'aria-live': 'off',
        'aria-atomic': 'true'
      });

      newEl.style.position = 'absolute';
      newEl.style.left = '0';
      newEl.style.right = '0';
      newEl.style.top = '0';
      newEl.style.bottom = '0';
      newEl.style.margin = '1.5%';
      return newEl;
    };

    _proto.updateStyle = function updateStyle(_ref) {
      var captionDiv = _ref.captionDiv;

      if (!this.player_.textTrackSettings) {
        return;
      }

      var overrides = this.player_.textTrackSettings.getValues();
      captionDiv = captionDiv || this.player_.getChild('TTMLTextTrackDisplay').el().firstChild;

      if (!captionDiv) {
        return;
      }

      removeStyle(captionDiv);
      var spans = captionDiv.getElementsByTagName('span');

      for (var i = 0; i < spans.length; i++) {
        var span = spans[i];
        span.parentNode.style.textAlign = 'center';

        if (overrides.color) {
          span.style.color = overrides.color;
        }

        if (overrides.textOpacity) {
          tryUpdateStyle(span, 'color', constructColor(overrides.color || '#fff', overrides.textOpacity));
        }

        if (overrides.backgroundColor) {
          span.style.backgroundColor = overrides.backgroundColor;
        }

        if (overrides.backgroundOpacity) {
          tryUpdateStyle(span, 'backgroundColor', constructColor(overrides.backgroundColor || '#000', overrides.backgroundOpacity));
        }

        if (overrides.windowColor) {
          if (overrides.windowOpacity) {
            tryUpdateStyle(span.parentNode, 'backgroundColor', constructColor(overrides.windowColor, overrides.windowOpacity));
          } else {
            span.parent.style.backgroundColor = overrides.windowColor;
          }
        }

        if (overrides.edgeStyle) {
          if (overrides.edgeStyle === 'dropshadow') {
            span.style.textShadow = "2px 2px 3px " + darkGray + ", 2px 2px 4px " + darkGray + ", 2px 2px 5px " + darkGray;
          } else if (overrides.edgeStyle === 'raised') {
            span.style.textShadow = "1px 1px " + darkGray + ", 2px 2px " + darkGray + ", 3px 3px " + darkGray;
          } else if (overrides.edgeStyle === 'depressed') {
            span.style.textShadow = "1px 1px " + lightGray + ", 0 1px " + lightGray + ", -1px -1px " + darkGray + ", 0 -1px " + darkGray;
          } else if (overrides.edgeStyle === 'uniform') {
            span.style.textShadow = "0 0 4px " + darkGray + ", 0 0 4px " + darkGray + ", 0 0 4px " + darkGray + ", 0 0 4px " + darkGray;
          }
        }

        if (overrides.fontPercent && overrides.fontPercent !== 1) {
          var fontSize = window.parseFloat(span.style.fontSize);
          span.style.fontSize = fontSize * overrides.fontPercent + 'px';
          span.style.height = 'auto';
          span.style.top = 'auto';
          span.style.bottom = '2px';
        }

        if (overrides.fontFamily && overrides.fontFamily !== 'default') {
          if (overrides.fontFamily === 'small-caps') {
            span.style.fontVariant = 'small-caps';
          } else {
            span.style.fontFamily = fontMap[overrides.fontFamily];
          }
        }
      }
    };

    return TTMLTextTrackDisplay;
  }(Component);

  videojs.registerComponent('TTMLTextTrackDisplay', TTMLTextTrackDisplay);

  /**
   * videojs-contrib-dash
   *
   * Use Dash.js to playback DASH content inside of Video.js via a SourceHandler
   */

  var Html5DashJS = /*#__PURE__*/function () {
    function Html5DashJS(source, tech, options) {
      var _this = this;

      // Get options from tech if not provided for backwards compatibility
      options = options || tech.options_;
      this.player = videojs(options.playerId);
      this.player.dash = this.player.dash || {};
      this.tech_ = tech;
      this.el_ = tech.el();
      this.elParent_ = this.el_.parentNode;
      this.hasFiniteDuration_ = false; // Do nothing if the src is falsey

      if (!source.src) {
        return;
      } // While the manifest is loading and Dash.js has not finished initializing
      // we must defer events and functions calls with isReady_ and then `triggerReady`
      // again later once everything is setup


      tech.isReady_ = false;

      if (Html5DashJS.updateSourceData) {
        videojs.log.warn('updateSourceData has been deprecated.' + ' Please switch to using hook("updatesource", callback).');
        source = Html5DashJS.updateSourceData(source);
      } // call updatesource hooks


      Html5DashJS.hooks('updatesource').forEach(function (hook) {
        source = hook(source);
      });
      var manifestSource = source.src;
      this.keySystemOptions_ = Html5DashJS.buildDashJSProtData(source.keySystemOptions);
      this.player.dash.mediaPlayer = dashjs.MediaPlayer().create();
      this.mediaPlayer_ = this.player.dash.mediaPlayer; // Log MedaPlayer messages through video.js

      if (Html5DashJS.useVideoJSDebug) {
        videojs.log.warn('useVideoJSDebug has been deprecated.' + ' Please switch to using hook("beforeinitialize", callback).');
        Html5DashJS.useVideoJSDebug(this.mediaPlayer_);
      }

      if (Html5DashJS.beforeInitialize) {
        videojs.log.warn('beforeInitialize has been deprecated.' + ' Please switch to using hook("beforeinitialize", callback).');
        Html5DashJS.beforeInitialize(this.player, this.mediaPlayer_);
      }

      Html5DashJS.hooks('beforeinitialize').forEach(function (hook) {
        hook(_this.player, _this.mediaPlayer_);
      }); // Must run controller before these two lines or else there is no
      // element to bind to.

      this.mediaPlayer_.initialize(); // Retrigger a dash.js-specific error event as a player error
      // See src/streaming/utils/ErrorHandler.js in dash.js code
      // Handled with error (playback is stopped):
      // - capabilityError
      // - downloadError
      // - manifestError
      // - mediaSourceError
      // - mediaKeySessionError
      // Not handled:
      // - timedTextError (video can still play)
      // - mediaKeyMessageError (only fires under 'might not work' circumstances)

      this.retriggerError_ = function (event) {
        if (event.error === 'capability' && event.event === 'mediasource') {
          // No support for MSE
          _this.player.error({
            code: 4,
            message: 'The media cannot be played because it requires a feature ' + 'that your browser does not support.'
          });
        } else if (event.error === 'manifestError' && ( // Manifest type not supported
        event.event.id === 'createParser' || // Codec(s) not supported
        event.event.id === 'codec' || // No streams available to stream
        event.event.id === 'nostreams' || // Error creating Stream object
        event.event.id === 'nostreamscomposed' || // syntax error parsing the manifest
        event.event.id === 'parse' || // a stream has multiplexed audio+video
        event.event.id === 'multiplexedrep')) {
          // These errors have useful error messages, so we forward it on
          _this.player.error({
            code: 4,
            message: event.event.message
          });
        } else if (event.error === 'mediasource') {
          // This error happens when dash.js fails to allocate a SourceBuffer
          // OR the underlying video element throws a `MediaError`.
          // If it's a buffer allocation fail, the message states which buffer
          // (audio/video/text) failed allocation.
          // If it's a `MediaError`, dash.js inspects the error object for
          // additional information to append to the error type.
          if (event.event.match('MEDIA_ERR_ABORTED')) {
            _this.player.error({
              code: 1,
              message: event.event
            });
          } else if (event.event.match('MEDIA_ERR_NETWORK')) {
            _this.player.error({
              code: 2,
              message: event.event
            });
          } else if (event.event.match('MEDIA_ERR_DECODE')) {
            _this.player.error({
              code: 3,
              message: event.event
            });
          } else if (event.event.match('MEDIA_ERR_SRC_NOT_SUPPORTED')) {
            _this.player.error({
              code: 4,
              message: event.event
            });
          } else if (event.event.match('MEDIA_ERR_ENCRYPTED')) {
            _this.player.error({
              code: 5,
              message: event.event
            });
          } else if (event.event.match('UNKNOWN')) {
            // We shouldn't ever end up here, since this would mean a
            // `MediaError` thrown by the video element that doesn't comply
            // with the W3C spec. But, since we should handle the error,
            // throwing a MEDIA_ERR_SRC_NOT_SUPPORTED is probably the
            // most reasonable thing to do.
            _this.player.error({
              code: 4,
              message: event.event
            });
          } else {
            // Buffer allocation error
            _this.player.error({
              code: 4,
              message: event.event
            });
          }
        } else if (event.error === 'capability' && event.event === 'encryptedmedia') {
          // Browser doesn't support EME
          _this.player.error({
            code: 5,
            message: 'The media cannot be played because it requires encryption ' + 'features that your browser does not support.'
          });
        } else if (event.error === 'key_session') {
          // This block handles pretty much all errors thrown by the
          // encryption subsystem
          _this.player.error({
            code: 5,
            message: event.event
          });
        } else if (event.error === 'download') {
          _this.player.error({
            code: 2,
            message: 'The media playback was aborted because too many consecutive ' + 'download errors occurred.'
          });
        } else if (event.error === 'mssError') {
          _this.player.error({
            code: 3,
            message: event.event
          });
        } else {
          // ignore the error
          return;
        } // only reset the dash player in 10ms async, so that the rest of the
        // calling function finishes


        setTimeout(function () {
          _this.mediaPlayer_.reset();
        }, 10);
      };

      this.mediaPlayer_.on(dashjs.MediaPlayer.events.ERROR, this.retriggerError_);

      this.getDuration_ = function (event) {
        var periods = event.data.Period_asArray;
        var oldHasFiniteDuration = _this.hasFiniteDuration_;

        if (event.data.mediaPresentationDuration || periods[periods.length - 1].duration) {
          _this.hasFiniteDuration_ = true;
        } else {
          // in case we run into a weird situation where we're VOD but then
          // switch to live
          _this.hasFiniteDuration_ = false;
        }

        if (_this.hasFiniteDuration_ !== oldHasFiniteDuration) {
          _this.player.trigger('durationchange');
        }
      };

      this.mediaPlayer_.on(dashjs.MediaPlayer.events.MANIFEST_LOADED, this.getDuration_); // Apply all dash options that are set

      if (options.dash) {
        Object.keys(options.dash).forEach(function (key) {
          var _this$mediaPlayer_;

          if (key === 'useTTML') {
            return;
          }

          var dashOptionsKey = 'set' + key.charAt(0).toUpperCase() + key.slice(1);
          var value = options.dash[key];

          if (_this.mediaPlayer_.hasOwnProperty(dashOptionsKey)) {
            // Providing a key without `set` prefix is now deprecated.
            videojs.log.warn('Using dash options in videojs-contrib-dash without the set prefix ' + ("has been deprecated. Change '" + key + "' to '" + dashOptionsKey + "'")); // Set key so it will still work

            key = dashOptionsKey;
          }

          if (!_this.mediaPlayer_.hasOwnProperty(key)) {
            videojs.log.warn("Warning: dash configuration option unrecognized: " + key);
            return;
          } // Guarantee `value` is an array


          if (!Array.isArray(value)) {
            value = [value];
          }

          (_this$mediaPlayer_ = _this.mediaPlayer_)[key].apply(_this$mediaPlayer_, value);
        });
      }

      this.mediaPlayer_.attachView(this.el_);

      if (options.dash && options.dash.useTTML) {
        this.ttmlContainer_ = this.player.addChild('TTMLTextTrackDisplay');
        this.mediaPlayer_.attachTTMLRenderingDiv(this.ttmlContainer_.el());
      } // Dash.js autoplays by default, video.js will handle autoplay


      this.mediaPlayer_.setAutoPlay(false); // Setup audio tracks

      setupAudioTracks.call(null, this.player, tech); // Setup text tracks

      setupTextTracks.call(null, this.player, tech, options); // Attach the source with any protection data

      this.mediaPlayer_.setProtectionData(this.keySystemOptions_);
      this.mediaPlayer_.attachSource(manifestSource);
      this.tech_.triggerReady();
    }
    /*
     * Iterate over the `keySystemOptions` array and convert each object into
     * the type of object Dash.js expects in the `protData` argument.
     *
     * Also rename 'licenseUrl' property in the options to an 'serverURL' property
     */


    Html5DashJS.buildDashJSProtData = function buildDashJSProtData(keySystemOptions) {
      var output = {};

      if (!keySystemOptions || !Array.isArray(keySystemOptions)) {
        return null;
      }

      for (var i = 0; i < keySystemOptions.length; i++) {
        var keySystem = keySystemOptions[i];
        var options = videojs.mergeOptions({}, keySystem.options);

        if (options.licenseUrl) {
          options.serverURL = options.licenseUrl;
          delete options.licenseUrl;
        }

        output[keySystem.name] = options;
      }

      return output;
    };

    var _proto = Html5DashJS.prototype;

    _proto.dispose = function dispose() {
      if (this.mediaPlayer_) {
        this.mediaPlayer_.off(dashjs.MediaPlayer.events.ERROR, this.retriggerError_);
        this.mediaPlayer_.off(dashjs.MediaPlayer.events.MANIFEST_LOADED, this.getDuration_);
        this.mediaPlayer_.reset();
      }

      if (this.player.dash) {
        delete this.player.dash;
      }

      if (this.ttmlContainer_) {
        this.ttmlContainer_.dispose();
        this.player.removeChild('TTMLTextTrackDisplay');
      }
    };

    _proto.duration = function duration() {
      if (this.mediaPlayer_.isDynamic() && !this.hasFiniteDuration_) {
        return Infinity;
      }

      return this.mediaPlayer_.duration();
    }
    /**
     * Get a list of hooks for a specific lifecycle
     *
     * @param {string} type the lifecycle to get hooks from
     * @param {Function|Function[]} [hook] Optionally add a hook tothe lifecycle
     * @return {Array} an array of hooks or epty if none
     * @method hooks
     */
    ;

    Html5DashJS.hooks = function hooks(type, hook) {
      Html5DashJS.hooks_[type] = Html5DashJS.hooks_[type] || [];

      if (hook) {
        Html5DashJS.hooks_[type] = Html5DashJS.hooks_[type].concat(hook);
      }

      return Html5DashJS.hooks_[type];
    }
    /**
     * Add a function hook to a specific dash lifecycle
     *
     * @param {string} type the lifecycle to hook the function to
     * @param {Function|Function[]} hook the function or array of functions to attach
     * @method hook
     */
    ;

    Html5DashJS.hook = function hook(type, _hook) {
      Html5DashJS.hooks(type, _hook);
    }
    /**
     * Remove a hook from a specific dash lifecycle.
     *
     * @param {string} type the lifecycle that the function hooked to
     * @param {Function} hook The hooked function to remove
     * @return {boolean} True if the function was removed, false if not found
     * @method removeHook
     */
    ;

    Html5DashJS.removeHook = function removeHook(type, hook) {
      var index = Html5DashJS.hooks(type).indexOf(hook);

      if (index === -1) {
        return false;
      }

      Html5DashJS.hooks_[type] = Html5DashJS.hooks_[type].slice();
      Html5DashJS.hooks_[type].splice(index, 1);
      return true;
    };

    return Html5DashJS;
  }();

  Html5DashJS.hooks_ = {};

  var canHandleKeySystems = function canHandleKeySystems(source) {
    // copy the source
    source = JSON.parse(JSON.stringify(source));

    if (Html5DashJS.updateSourceData) {
      videojs.log.warn('updateSourceData has been deprecated.' + ' Please switch to using hook("updatesource", callback).');
      source = Html5DashJS.updateSourceData(source);
    } // call updatesource hooks


    Html5DashJS.hooks('updatesource').forEach(function (hook) {
      source = hook(source);
    });
    var videoEl = document.createElement('video');

    if (source.keySystemOptions && !(window.navigator.requestMediaKeySystemAccess || // IE11 Win 8.1
    videoEl.msSetMediaKeys)) {
      return false;
    }

    return true;
  };

  videojs.DashSourceHandler = function () {
    return {
      canHandleSource: function canHandleSource(source) {
        var dashExtRE = /\.mpd/i;

        if (!canHandleKeySystems(source)) {
          return '';
        }

        if (videojs.DashSourceHandler.canPlayType(source.type)) {
          return 'probably';
        } else if (dashExtRE.test(source.src)) {
          return 'maybe';
        }

        return '';
      },
      handleSource: function handleSource(source, tech, options) {
        return new Html5DashJS(source, tech, options);
      },
      canPlayType: function canPlayType(type) {
        return videojs.DashSourceHandler.canPlayType(type);
      }
    };
  };

  videojs.DashSourceHandler.canPlayType = function (type) {
    var dashTypeRE = /^application\/dash\+xml/i;

    if (dashTypeRE.test(type)) {
      return 'probably';
    }

    return '';
  }; // Only add the SourceHandler if the browser supports MediaSourceExtensions


  if (window.MediaSource) {
    videojs.getTech('Html5').registerSourceHandler(videojs.DashSourceHandler(), 0);
  }

  videojs.Html5DashJS = Html5DashJS;

  return Html5DashJS;

})));
