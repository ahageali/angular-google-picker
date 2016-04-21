/*
 * angular-google-picker
 *
 * Interact with the Google API Picker
 * More information about the Google API can be found at https://developers.google.com/picker/
 *
 * (c) 2014 Loic Kartono
 * License: MIT
 */
(function () {
  'use strict';
  angular.module('lk-google-picker', [])

  .provider('lkGoogleSettings', function () {
    this.apiKey   = null;
    this.clientId = null;
    this.scopes   = ['https://www.googleapis.com/auth/drive'];
    this.features = ['MULTISELECT_ENABLED'];
    this.views    = [
      'DocsView().setIncludeFolders(true)',
      'DocsUploadView().setIncludeFolders(true)'
    ];
    this.locale   = 'en'; // Default to English

    /**
     * Provider factory $get method
     * Return Google Picker API settings
     */
    this.$get = ['$window', function ($window) {
      return {
        apiKey   : this.apiKey,
        clientId : this.clientId,
        scopes   : this.scopes,
        features : this.features,
        views    : this.views,
        locale   : this.locale,
        origin   : this.origin || $window.location.protocol + '//' + $window.location.host
      };
    }];

    /**
     * Set the API config params using a hash
     */
    this.configure = function (config) {
      for (var key in config) {
        this[key] = config[key];
      }
    };
  })

  .factory('GooglePicker', ['lkGoogleSettings', '$rootScope', function(lkGoogleSettings, $rootScope) {
    return function(onLoaded, onCancel, onPicked, onError) {
      var accessToken = null;
      onLoaded = onLoaded || angular.noop;
      onCancel = onCancel || angular.noop;
      onPicked = onPicked || angular.noop;
      onError = onError || angular.noop;

      /**
       * Load required modules
       */
      function instanciate () {
        gapi.load('auth', { 'callback': onApiAuthLoad });
        gapi.load('picker');
      }

      /**
       * OAuth autorization
       * If user is already logged in, then open the Picker modal
       */
      function onApiAuthLoad () {
        var authToken = gapi.auth.getToken();

        if (authToken) {
          handleAuthResult(authToken);
        } else {
          gapi.auth.authorize({
            'client_id' : lkGoogleSettings.clientId,
            'scope'     : lkGoogleSettings.scopes,
            'immediate' : true
          }, handleAuthResult);
        }
      }

      /**
       * Google API OAuth response
       */
      function handleAuthResult (result) {
        if (result && !result.error) {
          accessToken = result.access_token;
          openDialog();
        }
        else if (result) {
          onError(result);
        }
        else {
          onError(new Error('result object is not defined'));
        }
      }

      /**
       * Everything is good, open the files picker
       */
      function openDialog () {
        var picker = new google.picker.PickerBuilder()
                               .setLocale(lkGoogleSettings.locale)
                               .setOAuthToken(accessToken)
                               .setCallback(pickerResponse)
                               .setOrigin(lkGoogleSettings.origin);

        if (lkGoogleSettings.features.length > 0) {
          angular.forEach(lkGoogleSettings.features, function (feature, key) {
            picker.enableFeature(google.picker.Feature[feature]);
          });
        }

        if (lkGoogleSettings.views.length > 0) {
          angular.forEach(lkGoogleSettings.views, function (view, key) {
            //TODO: there has to be a better way for this
            view = eval('new google.picker.' + view);
            picker.addView(view);
          });
        }

        picker.build().setVisible(true);
      }

      /**
       * Callback invoked when interacting with the Picker
       * data: Object returned by the API
       */
      function pickerResponse (data) {
        gapi.client.load('drive', 'v2', function () {
          $rootScope.$apply(function() {
            if (data.action == google.picker.Action.LOADED) {
              onLoaded();
            }
            if (data.action == google.picker.Action.CANCEL) {
              onCancel();
            }
            if (data.action == google.picker.Action.PICKED) {
              onPicked({docs: data.docs});
            }
          });
        });
      }

      gapi.load('auth');
      gapi.load('picker');

      this.showPicker = instanciate;
    };
  }]);
})();
