/* Copyright 2020 The TensorFlow Authors. All Rights Reserved.

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

import {computed, customElement, property} from '@polymer/decorators';
import '@polymer/iron-icons';
import '@polymer/paper-button';
import '@polymer/paper-checkbox';
import '@polymer/paper-dialog';
import '@polymer/paper-header-panel';
import '@polymer/paper-icon-button';
import '@polymer/paper-listbox';
import '@polymer/paper-tabs';
import '@polymer/paper-toolbar';
import {PolymerElement, html} from '@polymer/polymer';
import {LegacyElementMixin} from '@polymer/polymer/lib/legacy/legacy-element-mixin';
import * as _ from 'lodash';

import {Canceller} from '../tf_backend/canceller';
import {environmentStore} from '../tf_backend/environmentStore';
import {experimentsStore} from '../tf_backend/experimentsStore';
import {RequestManager} from '../tf_backend/requestManager';
import {setRouter, getRouter} from '../tf_backend/router';
import {runsStore} from '../tf_backend/runsStore';
import '../tf_dashboard_common/tensorboard-color';
import {setUseHash} from '../tf_globals/globals';
//import {DO_NOT_SUBMIT} from '../tf-paginated-view/tf-paginated-view-store.html';
import {registerPluginIframe} from '../experimental/plugin_util/plugin-host-ipc';
import {
  TAB,
  getString,
  migrateLegacyURLScheme,
  setString,
} from '../tf_storage/storage';
import {
  ActiveDashboardsLoadState,
  Dashboard,
  dashboardRegistry,
} from './registry';
import {AutoReloadBehavior} from './autoReloadBehavior';

/**
 * @typedef {{
 *   plugin: string,
 *   loadingMechanism: !LoadingMechanism,
 *   tabName: string,
 *   disableReload: boolean,
 *   removeDom: boolean,
 * }}
 */
const DashboardDatum = {};

/**
 * @typedef {(LoadingMechanism$CUSTOM_ELEMENT | LoadingMechanism$IFRAME)}
 */
const LoadingMechanism = {};

/**
 * @typedef {{
 *   type: LoadingMechanism$CUSTOM_ELEMENT$Type,
 *   elementName: string,
 * }}
 */
const LoadingMechanism$CUSTOM_ELEMENT = {};

/**
 * @typedef {{
 *   type: LoadingMechanism$IFRAME$Type,
 *   modulePath: string,
 * }}
 */
const LoadingMechanism$IFRAME = {};

// Closure's type system doesn't have string literal types.
/** @enum {string} */
const LoadingMechanism$CUSTOM_ELEMENT$Type = {_: 'CUSTOM_ELEMENT'};

/** @enum {string} */
const LoadingMechanism$IFRAME$Type = {_: 'IFRAME'};

const DATA_SELECTION_CHANGE_DEBOUNCE_MS = 200;

type LocationType = {href: string; origin: string};

const lib = {
  getLocation(): LocationType {
    return window.location;
  },
};
const TEST_ONLY = {
  lib,
};

@customElement('tf-tensorboard')
class TfTensorboard extends LegacyElementMixin(PolymerElement) {
  static readonly template = html`
    <paper-dialog with-backdrop="" id="settings">
      <h2>Settings</h2>
      <paper-checkbox id="auto-reload-checkbox" checked="{{autoReloadEnabled}}">
        Reload data every <span>[[autoReloadIntervalSecs]]</span>s.
      </paper-checkbox>
      <paper-input
        id="paginationLimitInput"
        label="Pagination limit"
        always-float-label=""
        type="number"
        min="1"
        step="1"
        on-change="_paginationLimitChanged"
        on-value-changed="_paginationLimitValidate"
      ></paper-input>
    </paper-dialog>
    <paper-header-panel>
      <paper-toolbar id="toolbar" slot="header" class="header">
        <div id="toolbar-content" slot="top">
          <template is="dom-if" if="[[!_homePath]]">
            <div class="toolbar-title">[[brand]]</div>
          </template>
          <template is="dom-if" if="[[_homePath]]">
            <a
              href="[[_homePath]]"
              rel="noopener noreferrer"
              class="toolbar-title"
              >[[brand]]</a
            >
          </template>
          <template is="dom-if" if="[[_activeDashboardsNotLoaded]]">
            <span class="toolbar-message">
              Loading active dashboards…
            </span>
          </template>
          <template is="dom-if" if="[[_activeDashboardsLoaded]]">
            <paper-tabs
              noink=""
              scrollable=""
              selected="{{_selectedDashboard}}"
              attr-for-selected="data-dashboard"
            >
              <template
                is="dom-repeat"
                items="[[_dashboardData]]"
                as="dashboardDatum"
              >
                <template
                  is="dom-if"
                  if="[[_isDashboardActive(disabledDashboards, _activeDashboards, dashboardDatum)]]"
                >
                  <paper-tab
                    data-dashboard$="[[dashboardDatum.plugin]]"
                    title="[[dashboardDatum.tabName]]"
                  >
                    [[dashboardDatum.tabName]]
                  </paper-tab>
                </template>
              </template>
            </paper-tabs>
            <template
              is="dom-if"
              if="[[_inactiveDashboardsExist(_dashboardData, disabledDashboards, _activeDashboards)]]"
            >
              <paper-dropdown-menu
                label="INACTIVE"
                no-label-float=""
                noink=""
                style="margin-left: 12px"
              >
                <paper-listbox
                  id="inactive-dashboards-menu"
                  slot="dropdown-content"
                  selected="{{_selectedDashboard}}"
                  attr-for-selected="data-dashboard"
                >
                  <template
                    is="dom-repeat"
                    items="[[_dashboardData]]"
                    as="dashboardDatum"
                  >
                    <template
                      is="dom-if"
                      if="[[_isDashboardInactive(disabledDashboards, _activeDashboards, dashboardDatum)]]"
                      restamp=""
                    >
                      <paper-item data-dashboard$="[[dashboardDatum.plugin]]"
                        >[[dashboardDatum.tabName]]</paper-item
                      >
                    </template>
                  </template>
                </paper-listbox>
              </paper-dropdown-menu>
            </template>
          </template>
          <div class="global-actions">
            <slot name="injected-header-items"></slot>
            <paper-icon-button
              id="reload-button"
              class$="[[_getDataRefreshingClass(_refreshing)]]"
              disabled$="[[_isReloadDisabled]]"
              icon="refresh"
              on-tap="reload"
              title$="Last updated: [[_lastReloadTimeShort]]"
            ></paper-icon-button>
            <paper-icon-button
              icon="settings"
              on-tap="openSettings"
              id="settings-button"
            ></paper-icon-button>
            <a
              href="https://github.com/tensorflow/tensorboard/blob/master/README.md"
              rel="noopener noreferrer"
              tabindex="-1"
              target="_blank"
            >
              <paper-icon-button icon="help-outline"></paper-icon-button>
            </a>
          </div>
        </div>
      </paper-toolbar>

      <div id="content-pane" class="fit">
        <slot name="injected-overview"></slot>
        <div id="content">
          <template is="dom-if" if="[[_activeDashboardsFailedToLoad]]">
            <div class="warning-message">
              <h3>Failed to load the set of active dashboards.</h3>
              <p>
                This can occur if the TensorBoard backend is no longer running.
                Perhaps this page is cached?
              </p>

              <p>
                If you think that you’ve fixed the problem, click the reload
                button in the top-right.
                <template is="dom-if" if="[[autoReloadEnabled]]">
                  We’ll try to reload every
                  [[autoReloadIntervalSecs]]&nbsp;seconds as well.
                </template>
              </p>

              <p>
                <i>Last reload: [[_lastReloadTime]]</i>
                <template is="dom-if" if="[[_dataLocation]]">
                  <p>
                    <i
                      >Log directory:
                      <span id="data_location">[[_dataLocation]]</span></i
                    >
                  </p>
                </template>
              </p>
            </div>
          </template>
          <template is="dom-if" if="[[_showNoDashboardsMessage]]">
            <div class="warning-message">
              <h3>No dashboards are active for the current data set.</h3>
              <p>Probable causes:</p>
              <ul>
                <li>You haven’t written any data to your event files.</li>
                <li>TensorBoard can’t find your event files.</li>
              </ul>

              If you’re new to using TensorBoard, and want to find out how to
              add data and set up your event files, check out the
              <a
                href="https://github.com/tensorflow/tensorboard/blob/master/README.md"
                >README</a
              >
              and perhaps the
              <a
                href="https://www.tensorflow.org/get_started/summaries_and_tensorboard"
                >TensorBoard tutorial</a
              >.
              <p>
                If you think TensorBoard is configured properly, please see
                <a
                  href="https://github.com/tensorflow/tensorboard/blob/master/README.md#my-tensorboard-isnt-showing-any-data-whats-wrong"
                  >the section of the README devoted to missing data problems</a
                >
                and consider filing an issue on GitHub.
              </p>

              <p>
                <i>Last reload: [[_lastReloadTime]]</i>
                <template is="dom-if" if="[[_dataLocation]]">
                  <p>
                    <i
                      >Data location:
                      <span id="data_location">[[_dataLocation]]</span></i
                    >
                  </p>
                </template>
              </p>
            </div>
          </template>
          <template is="dom-if" if="[[_showNoSuchDashboardMessage]]">
            <div class="warning-message">
              <h3>
                There’s no dashboard by the name of
                “<tt>[[_selectedDashboard]]</tt>.”
              </h3>
              <template is="dom-if" if="[[_activeDashboardsLoaded]]">
                <p>You can select a dashboard from the list above.</p></template
              >

              <p>
                <i>Last reload: [[_lastReloadTime]]</i>
                <template is="dom-if" if="[[_dataLocation]]">
                  <p>
                    <i
                      >Data location:
                      <span id="data_location">[[_dataLocation]]</span></i
                    >
                  </p>
                </template>
              </p>
            </div>
          </template>
          <template
            is="dom-repeat"
            id="dashboards-template"
            items="[[_dashboardData]]"
            as="dashboardDatum"
            on-dom-change="_onTemplateChanged"
          >
            <div
              class="dashboard-container"
              data-dashboard$="[[dashboardDatum.plugin]]"
              data-selected$="[[_selectedStatus(_selectedDashboard, dashboardDatum.plugin)]]"
            >
              <!-- Dashboards will be injected here dynamically. -->
            </div>
          </template>
        </div>
      </div>
    </paper-header-panel>

    <style>
      :host {
        height: 100%;
        display: block;
        background-color: var(--paper-grey-100);
      }

      #toolbar {
        background-color: var(
          --tb-toolbar-background-color,
          var(--tb-orange-strong)
        );
        -webkit-font-smoothing: antialiased;
      }

      .toolbar-title {
        font-size: 20px;
        margin-left: 6px;
        /* Increase clickable area for case where title is an anchor. */
        padding: 4px;
        text-rendering: optimizeLegibility;
        letter-spacing: -0.025em;
        font-weight: 500;
        display: var(--tb-toolbar-title-display, block);
      }

      a.toolbar-title {
        /* Override default anchor color. */
        color: inherit;
        /* Override default anchor text-decoration. */
        text-decoration: none;
      }

      .toolbar-message {
        opacity: 0.7;
        -webkit-font-smoothing: antialiased;
        font-size: 14px;
        font-weight: 500;
      }

      paper-tabs {
        flex-grow: 1;
        width: 100%;
        height: 100%;
        --paper-tabs-selection-bar-color: white;
        --paper-tabs-content: {
          -webkit-font-smoothing: antialiased;
          text-transform: uppercase;
        }
      }

      paper-dropdown-menu {
        --paper-input-container-color: rgba(255, 255, 255, 0.8);
        --paper-input-container-focus-color: white;
        --paper-input-container-input-color: white;
        --paper-dropdown-menu-icon: {
          color: white;
        }
        --paper-dropdown-menu-input: {
          -webkit-font-smoothing: antialiased;
          font-size: 14px;
          font-weight: 500;
        }
        --paper-input-container-label: {
          -webkit-font-smoothing: antialiased;
          font-size: 14px;
          font-weight: 500;
        }
      }

      paper-dropdown-menu paper-item {
        -webkit-font-smoothing: antialiased;
        font-size: 14px;
        font-weight: 500;
        text-transform: uppercase;
      }

      #inactive-dashboards-menu {
        --paper-listbox-background-color: var(
          --tb-toolbar-background-color,
          var(--tb-orange-strong)
        );
        --paper-listbox-color: white;
      }

      .global-actions {
        display: inline-flex; /* Ensure that icons stay aligned */
        justify-content: flex-end;
        align-items: center;
        text-align: right;
        color: white;
      }

      .global-actions a {
        color: white;
      }

      #toolbar-content {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
      }

      #content-pane {
        align-items: stretch;
        display: flex;
        flex-direction: column;
        height: 100%;
        justify-content: stretch;
        width: 100%;
      }

      #content {
        flex: 1 1;
        overflow: hidden;
      }

      .dashboard-container {
        height: 100%;
      }

      /* Hide unselected dashboards. We still display them within a container
         of height 0 since Plottable produces degenerate charts when charts are
         reloaded while not displayed. */
      .dashboard-container:not([data-selected]) {
        max-height: 0;
        overflow: hidden;
        position: relative;
        /** We further make containers invisible. Some elements may anchor to
            the viewport instead of the container, in which case setting the max
            height here to 0 will not hide them. */
        visibility: hidden;
      }

      .dashboard-container iframe {
        border: none;
        height: 100%;
        width: 100%;
      }

      .warning-message {
        max-width: 540px;
        margin: 80px auto 0 auto;
      }

      [disabled] {
        opacity: 0.2;
        color: white;
      }

      #reload-button.refreshing {
        animation: rotate 2s linear infinite;
      }

      @keyframes rotate {
        0% {
          transform: rotate(0deg);
        }
        50% {
          transform: rotate(180deg);
        }
        100% {
          transform: rotate(360deg);
        }
      }
    </style>
  `;

  @property({type: String})
  brand: string = 'TensorBoard-X';

  @property({type: String})
  homePath: string = '';

  @property({
    type: String,
    observer: '_updateTitle',
  })
  title: string;

  @property({
    type: Object,
    observer: '_updateRouter',
  })
  router: object;

  @property({type: String})
  demoDir: string = null;

  @property({type: Boolean})
  useHash: boolean = false;

  @property({type: String})
  disabledDashboards: string = '';

  @property({type: Object})
  _pluginsListing: object = {};

  @property({type: String})
  _activeDashboardsLoadState: string = ActiveDashboardsLoadState.NOT_LOADED;

  @property({
    type: String,
    observer: '_selectedDashboardChanged',
  })
  _selectedDashboard: string = getString(TAB) || null;

  @property({type: String})
  _dashboardToMaybeRemove: string;

  @property({type: Object})
  _dashboardContainersStamped: object = () => ({});

  @property({type: Boolean})
  _isReloadDisabled: boolean = false;

  @property({type: String})
  _lastReloadTime: string = 'not yet loaded';

  @property({type: String})
  _lastReloadTimeShort: string = 'Not yet loaded';

  @property({type: String})
  _dataLocation: string = null;

  @property({type: Object})
  _requestManager: RequestManager = new RequestManager();

  @property({type: Object})
  _canceller: Canceller = new Canceller();

  @property({type: Boolean})
  _refreshing: boolean = false;

  behaviors = [AutoReloadBehavior];

  @computed('homePath')
  get _homePath(): string {
    var homePath = this.homePath;
    if (!homePath) {
      return '';
    }
    const location = lib.getLocation();
    const url = new URL(homePath, location.href);
    // Do not allow javascript:, data:, or unknown protocols to render
    // with Polymer data binding.
    const isHttp = url.protocol === 'http:' || url.protocol === 'https:';
    const sameOrigin = url.origin === location.origin;
    if (!isHttp) {
      throw new RangeError(
        `Expect 'homePath' to be of http: or https:. ${homePath}`
      );
    }
    if (!sameOrigin) {
      throw new RangeError(
        `Expect 'homePath' be a path or have the same origin. ${homePath} vs. ${location.origin}`
      );
    }
    return isHttp && sameOrigin ? url.toString() : '';
  }
  _activeDashboardsUpdated(activeDashboards, selectedDashboard) {}
  /**
   * @param {string?} disabledDashboards comma-separated
   * @param {Array<string>?} activeDashboards if null, nothing is active
   * @param {Object} dashboardDatum
   * @return {boolean}
   */
  _isDashboardActive(disabledDashboards, activeDashboards, dashboardDatum) {
    if (
      (disabledDashboards || '').split(',').indexOf(dashboardDatum.plugin) >= 0
    ) {
      // Explicitly disabled.
      return false;
    }
    if (!(activeDashboards || []).includes(dashboardDatum.plugin)) {
      // Inactive.
      return false;
    }
    return true;
  }
  /**
   * Determine whether a dashboard is enabled but not active.
   *
   * @param {string?} disabledDashboards comma-separated
   * @param {Array<string>?} activeDashboards if null, nothing is active
   * @param {Object} dashboardDatum
   * @return {boolean}
   */
  _isDashboardInactive(disabledDashboards, activeDashboards, dashboardDatum) {
    if (
      (disabledDashboards || '').split(',').indexOf(dashboardDatum.plugin) >= 0
    ) {
      // Disabled dashboards don't appear at all; they're not just
      // inactive.
      return false;
    }
    if (!(activeDashboards || []).includes(dashboardDatum.plugin)) {
      // Inactive.
      return true;
    }
    return false;
  }
  _inactiveDashboardsExist(dashboards, disabledDashboards, activeDashboards) {
    if (!activeDashboards) {
      // Not loaded yet. Show nothing.
      return false;
    }
    const workingSet = new Set();
    dashboards.forEach((d) => {
      workingSet.add(d.plugin);
    });
    (disabledDashboards || '').split(',').forEach((d) => {
      workingSet.delete(d.plugin);
    });
    activeDashboards.forEach((d) => {
      workingSet.delete(d);
    });
    return workingSet.size > 0;
  }
  _getDashboardFromIndex(dashboards, index) {
    return dashboards[index];
  }
  _selectedStatus(selectedDashboard, candidateDashboard) {
    return selectedDashboard === candidateDashboard;
  }
  /**
   * Handle a change in the selected dashboard by persisting the current
   * selection to the hash and logging a pageview if analytics are enabled.
   */
  _selectedDashboardChanged(selectedDashboard) {
    const pluginString = selectedDashboard || '';
    setString(TAB, pluginString);
    // Record this dashboard selection as a page view.
    let pathname = window.location.pathname;
    pathname += pathname.endsWith('/') ? pluginString : '/' + pluginString;
    const ga: any = window['ga']; // note: analytics disabled in open source TB
    ga('set', 'page', pathname);
    ga('send', 'pageview');
  }
  /**
   * If no dashboard is selected but dashboards are available,
   * set the selected dashboard to the first active one.
   */
  _updateSelectedDashboardFromActive(selectedDashboard, activeDashboards) {
    if (activeDashboards && selectedDashboard == null) {
      selectedDashboard = activeDashboards[0] || null;
      if (selectedDashboard != null) {
        // Use location.replace for this call to avoid breaking back-button navigation.
        // Note that this will precede the update to tf_storage triggered by updating
        // _selectedDashboard and make it a no-op.
        setString(TAB, selectedDashboard, {
          useLocationReplace: true,
        });
        // Note: the following line will re-trigger this handler, but it
        // will be a no-op since selectedDashboard is no longer null.
        this._selectedDashboard = selectedDashboard;
      }
    }
  }
  _updateSelectedDashboardFromHash() {
    const dashboardName = getString(TAB);
    this.set('_selectedDashboard', dashboardName || null);
  }
  /**
   * Make sure that the currently selected dashboard actually has a
   * Polymer component; if it doesn't, create one.
   *
   * We have to stamp each dashboard before we can interact with it:
   * for instance, to ask it to reload. Conversely, we can't stamp a
   * dashboard until its _container_ is itself stamped. (Containers
   * are stamped declaratively by a `<dom-repeat>` in the HTML
   * template.)
   *
   * We also wait for the set of active dashboards to be loaded
   * before we stamp anything. This prevents us from stamping a
   * dashboard that's not actually enabled (e.g., if the user
   * navigates to `/#text` when the text plugin is disabled).
   *
   * If the currently selected dashboard is not a real dashboard,
   * this does nothing.
   *
   * @param {!Object<string, !DashboardDatum>} dashboardRegistry
   */
  _ensureSelectedDashboardStamped(
    dashboardRegistry,
    containersStamped,
    activeDashboards,
    selectedDashboard
  ) {
    if (
      !activeDashboards ||
      !selectedDashboard ||
      !containersStamped[selectedDashboard]
    ) {
      return;
    }
    const previous = this._dashboardToMaybeRemove;
    this._dashboardToMaybeRemove = selectedDashboard;
    if (previous && previous != selectedDashboard) {
      if (dashboardRegistry[previous].removeDom) {
        const div = this.$$(`.dashboard-container[data-dashboard=${previous}]`);
        if (div.firstChild) {
          div.firstChild.remove();
        }
      }
    }
    const container = this.$$(
      `.dashboard-container[data-dashboard=${selectedDashboard}]`
    );
    if (!container) {
      // This dashboard doesn't exist. Nothing to do here.
      return;
    }
    const dashboard = dashboardRegistry[selectedDashboard];
    // Use .children, not .childNodes, to avoid counting comment nodes.
    if (container.children.length === 0) {
      const loadingMechanism = dashboard.loadingMechanism;
      switch (loadingMechanism.type) {
        case 'CUSTOM_ELEMENT': {
          const component = document.createElement(
            loadingMechanism.elementName
          );
          component.id = 'dashboard'; // used in `_selectedDashboardComponent`
          container.appendChild(component);
          break;
        }
        case 'IFRAME': {
          this._renderPluginIframe(
            container,
            selectedDashboard,
            loadingMechanism
          );
          break;
        }
        default: {
          console.warn('Invariant violation:', loadingMechanism);
          break;
        }
      }
    }
    this.set('_isReloadDisabled', dashboard.disableReload);
  }
  _renderPluginIframe(container, selectedDashboard, loadingMechanism) {
    const iframe = document.createElement('iframe');
    iframe.id = 'dashboard'; // used in `_selectedDashboardComponent`
    registerPluginIframe(iframe, selectedDashboard);
    const srcUrl = new URL('data/plugin_entry.html', window.location.href);
    srcUrl.searchParams.set('name', selectedDashboard);
    iframe.setAttribute('src', srcUrl.toString());
    container.appendChild(iframe);
  }
  /**
   * Get the Polymer component corresponding to the currently
   * selected dashboard. For instance, the result might be an
   * instance of `<tf-scalar-dashboard>`.
   *
   * If the dashboard does not exist (e.g., the set of active
   * dashboards has not loaded or has failed to load, or the user
   * has selected a dashboard for which we have no implementation),
   * `null` is returned.
   */
  _selectedDashboardComponent() {
    const selectedDashboard = this._selectedDashboard;
    var dashboard = this.$$(
      `.dashboard-container[data-dashboard=${selectedDashboard}] #dashboard`
    );
    return dashboard;
  }
  ready() {
    setUseHash(this.useHash);
    this._updateSelectedDashboardFromHash();
    window.addEventListener(
      'hashchange',
      () => {
        this._updateSelectedDashboardFromHash();
      },
      /*useCapture=*/ false
    );
    environmentStore.addListener(() => {
      this._dataLocation = environmentStore.getDataLocation();
      const title = environmentStore.getWindowTitle();
      if (title) {
        window.document.title = title;
      }
    });
    // Migration must happen after calling `setUseHash`.
    migrateLegacyURLScheme();
    this._reloadData();
    this._lastReloadTime = new Date().toString();
  }

  @computed('_dashboardData', '_pluginsListing')
  get _activeDashboards(): unknown[] {
    if (!this._dashboardData) return [];
    return this._dashboardData
      .map((d) => d.plugin)
      .filter((dashboardName) => {
        // TODO(stephanwlee): Remove boolean code path when releasing
        // 2.0.
        // PluginsListing can be an object whose key is name of the
        // plugin and value is a boolean indicating whether if it is
        // enabled. This is deprecated but we will maintain backwards
        // compatibility for some time.
        const maybeMetadata = this._pluginsListing[dashboardName];
        if (typeof maybeMetadata === 'boolean') return maybeMetadata;
        return maybeMetadata && maybeMetadata.enabled;
      });
  }

  _onTemplateChanged() {
    // This will trigger an observer that kicks off everything.
    const dashboardContainersStamped = {};
    const containers = this.root.querySelectorAll('.dashboard-container');
    for (const container of containers as any) {
      dashboardContainersStamped[container.dataset.dashboard] = true;
    }
    this._dashboardContainersStamped = dashboardContainersStamped;
  }

  @computed('_pluginsListing')
  get _dashboardRegistry(): object {
    var pluginsListing = this._pluginsListing;
    const registry = {};
    for (const [name, legacyMetadata] of Object.entries(dashboardRegistry)) {
      registry[name] = {
        plugin: legacyMetadata.plugin,
        loadingMechanism: {
          type: 'CUSTOM_ELEMENT',
          elementName: legacyMetadata.elementName,
        },
        tabName: legacyMetadata.tabName.toUpperCase(),
        disableReload: legacyMetadata.isReloadDisabled || false,
        removeDom: legacyMetadata.shouldRemoveDom || false,
      };
    }
    if (pluginsListing != null) {
      for (const [name, backendMetadata] of Object.entries(pluginsListing)) {
        if (typeof backendMetadata === 'boolean') {
          // Legacy backend (prior to #2257). No metadata to speak of.
          continue;
        }
        let loadingMechanism;
        switch (backendMetadata.loading_mechanism.type) {
          case 'NONE':
            // Legacy backend plugin.
            if (registry[name] == null) {
              console.warn(
                'Plugin has no loading mechanism and no baked-in registry entry: %s',
                name
              );
            }
            continue;
          case 'CUSTOM_ELEMENT':
            loadingMechanism = {
              type: 'CUSTOM_ELEMENT',
              elementName: backendMetadata.loading_mechanism.element_name,
            };
            break;
          case 'IFRAME':
            loadingMechanism = {
              type: 'IFRAME',
              modulePath: backendMetadata.loading_mechanism.module_path,
            };
            break;
          default:
            console.warn(
              'Unknown loading mechanism for plugin %s: %s',
              name,
              backendMetadata.loading_mechanism
            );
            continue;
        }
        if (loadingMechanism == null) {
          console.error(
            'Invariant violation: loadingMechanism is %s for %s',
            loadingMechanism,
            name
          );
        }
        registry[name] = {
          plugin: name,
          loadingMechanism: loadingMechanism,
          tabName: backendMetadata.tab_name.toUpperCase(),
          disableReload: backendMetadata.disable_reload,
          removeDom: backendMetadata.remove_dom,
        };
      }
    }
    // Reorder to list all values from the `/data/plugins_listing`
    // response first and in their listed order.
    const orderedRegistry = {};
    for (const plugin of Object.keys(pluginsListing)) {
      if (registry[plugin]) {
        orderedRegistry[plugin] = registry[plugin];
      }
    }
    Object.assign(orderedRegistry, registry);
    return orderedRegistry;
  }

  @computed('_dashboardRegistry')
  get _dashboardData(): Dashboard[] {
    var dashboardRegistry = this._dashboardRegistry;
    return Object.values(dashboardRegistry);
  }

  _fetchPluginsListing() {
    this._canceller.cancelAll();
    const updatePluginsListing = this._canceller.cancellable((result) => {
      if (result.cancelled) {
        return;
      }
      this._pluginsListing = result.value as any;
      this._activeDashboardsLoadState = ActiveDashboardsLoadState.LOADED;
    });
    const onFailure = () => {
      if (
        this._activeDashboardsLoadState === ActiveDashboardsLoadState.NOT_LOADED
      ) {
        this._activeDashboardsLoadState = ActiveDashboardsLoadState.FAILED;
      } else {
        console.warn(
          'Failed to reload the set of active plugins; using old value.'
        );
      }
    };
    return this._requestManager
      .request(getRouter().pluginsListing())
      .then(updatePluginsListing, onFailure);
  }

  @computed('_activeDashboardsLoadState')
  get _activeDashboardsNotLoaded(): boolean {
    var state = this._activeDashboardsLoadState;
    return state === ActiveDashboardsLoadState.NOT_LOADED;
  }

  @computed('_activeDashboardsLoadState')
  get _activeDashboardsLoaded(): boolean {
    var state = this._activeDashboardsLoadState;
    return state === ActiveDashboardsLoadState.LOADED;
  }

  @computed('_activeDashboardsLoadState')
  get _activeDashboardsFailedToLoad(): boolean {
    var state = this._activeDashboardsLoadState;
    return state === ActiveDashboardsLoadState.FAILED;
  }

  @computed(
    '_activeDashboardsLoaded',
    '_activeDashboards',
    '_selectedDashboard'
  )
  get _showNoDashboardsMessage(): boolean {
    var loaded = this._activeDashboardsLoaded;
    var activeDashboards = this._activeDashboards;
    var selectedDashboard = this._selectedDashboard;
    return loaded && activeDashboards.length === 0 && selectedDashboard == null;
  }

  @computed(
    '_activeDashboardsLoaded',
    '_dashboardRegistry',
    '_selectedDashboard'
  )
  get _showNoSuchDashboardMessage(): boolean {
    var loaded = this._activeDashboardsLoaded;
    var registry = this._dashboardRegistry;
    var selectedDashboard = this._selectedDashboard;
    return loaded && !!selectedDashboard && registry[selectedDashboard] == null;
  }

  _updateRouter(router) {
    setRouter(router);
  }

  _updateTitle(title) {
    if (title) {
      this.set('brand', title);
    }
  }

  reload() {
    if (this._isReloadDisabled) return;
    this._reloadData().then(() => {
      const dashboard = this._selectedDashboardComponent();
      if (dashboard && (dashboard as any).reload) (dashboard as any).reload();
    });
    this._lastReloadTime = new Date().toString();
  }

  _reloadData() {
    this._refreshing = true;
    return Promise.all([
      this._fetchPluginsListing(),
      environmentStore.refresh(),
      runsStore.refresh(),
      experimentsStore.refresh(),
    ])
      .then(() => {
        this._lastReloadTimeShort = new Date().toLocaleDateString(undefined, {
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric',
        });
      })
      .finally(() => {
        this._refreshing = false;
      });
  }

  _getDataRefreshingClass() {
    return this._refreshing ? 'refreshing' : '';
  }

  openSettings() {
    // (cast through `any` because `PaperDialogElement` does not declare `open`)
    (this.$.settings as any).open();
    // DO NOT SUBMIT: this.$.paginationLimitInput.value = tf_paginated_view.getLimit();
  }

  _paginationLimitValidate(event) {
    event.target.validate();
  }

  _paginationLimitChanged(e) {
    const value = Number.parseInt(e.target.value, 10);
    // We set type="number" and min="1" on the input, but Polymer
    // doesn't actually enforce those, so we have to check manually.
    if (value === +value && value > 0) {
      // DO NOT SUBMIT: tf_paginated_view.setLimit(value);
    }
  }
}
