/* Copyright 2015 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/
import '@polymer/iron-icons';
import '@polymer/paper-button';
import '@polymer/paper-checkbox';
import '@polymer/paper-dialog';
import '@polymer/paper-header-panel';
import '@polymer/paper-listbox';
import '@polymer/paper-icon-button';
import '@polymer/paper-tabs';
import '@polymer/paper-toolbar';
import {DO_NOT_SUBMIT} from '../tf-imports/polymer.html';
import {DO_NOT_SUBMIT} from '../tf-backend/tf-backend.html';
import {DO_NOT_SUBMIT} from '../tf-dashboard-common/tensorboard-color.html';
import {DO_NOT_SUBMIT} from '../tf-globals/tf-globals.html';
import {DO_NOT_SUBMIT} from '../tf-imports/lodash.html';
import {DO_NOT_SUBMIT} from '../tf-paginated-view/tf-paginated-view-store.html';
import {DO_NOT_SUBMIT} from '../tf-storage/tf-storage.html';
import {DO_NOT_SUBMIT} from '../tf-plugin-util/plugin-host.html';
import {DO_NOT_SUBMIT} from 'registry.html';
import {DO_NOT_SUBMIT} from 'tf-tensorboard';
/* Copyright 2015 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/
export var AUTORELOAD_LOCALSTORAGE_KEY = 'TF.TensorBoard.autoReloadEnabled';
var getAutoReloadFromLocalStorage: () => boolean = () => {
  var val = window.localStorage.getItem(AUTORELOAD_LOCALSTORAGE_KEY);
  return val === 'true' || val == null; // defaults to true
};
function forceDisableAutoReload(): boolean {
  return new URLSearchParams(window.location.search).has('_DisableAutoReload');
}
/**
 * @polymerBehavior
 */
export var AutoReloadBehavior = {
  properties: {
    autoReloadEnabled: {
      type: Boolean,
      observer: '_autoReloadObserver',
      value: getAutoReloadFromLocalStorage,
    },
    _autoReloadId: {
      type: Number,
    },
    // Tracks whethere an auto reload was missed because the document was not visible.
    _missedAutoReload: {
      type: Boolean,
      value: false,
    },
    _boundHandleVisibilityChange: {
      type: Object,
    },
    autoReloadIntervalSecs: {
      type: Number,
      value: 30,
    },
  },
  attached: function() {
    this._boundHandleVisibilityChange = this._handleVisibilityChange.bind(this);
    document.addEventListener(
      'visibilitychange',
      this._boundHandleVisibilityChange
    );
  },
  detached: function() {
    window.clearTimeout(this._autoReloadId);
    document.removeEventListener(
      'visibilitychange',
      this._boundHandleVisibilityChange
    );
  },
  _autoReloadObserver: function(autoReload) {
    window.localStorage.setItem(AUTORELOAD_LOCALSTORAGE_KEY, autoReload);
    if (autoReload && !forceDisableAutoReload()) {
      this._autoReloadId = window.setTimeout(
        () => this._doAutoReload(),
        this.autoReloadIntervalSecs * 1000
      );
    } else {
      window.clearTimeout(this._autoReloadId);
    }
  },
  _doAutoReload: function() {
    if (this._isDocumentVisible()) {
      this._doReload();
    } else {
      this._missedAutoReload = true;
    }
    this._autoReloadId = window.setTimeout(
      () => this._doAutoReload(),
      this.autoReloadIntervalSecs * 1000
    );
  },
  _doReload: function() {
    if (this.reload == null) {
      throw new Error('AutoReloadBehavior requires a reload method');
    }
    this.reload();
  },
  _handleVisibilityChange: function() {
    if (this._isDocumentVisible() && this._missedAutoReload) {
      this._missedAutoReload = false;
      this._doReload();
    }
  },
  /**
   * Wraps Page Visibility API call to determine if document is visible.
   * Can be overriden for testing purposes.
   */
  _isDocumentVisible: function() {
    return document.visibilityState === 'visible';
  },
};
