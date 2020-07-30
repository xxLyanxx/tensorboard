load("//tensorboard/defs:defs.bzl", "tf_ts_library")

package(default_visibility = ["//tensorboard:internal"])

licenses(["notice"])  # Apache 2.0

tf_ts_library(
    name = "tf_tensorboard",
    srcs = [
        "autoReloadBehavior.ts",
        "style.ts",
        "tf-tensorboard.ts",
    ],
    strict_checks = False,
    visibility = ["//visibility:public"],
    deps = [
        ":registry",
        "//tensorboard/components_polymer3/experimental/plugin_util:host_internals",
        "//tensorboard/components_polymer3/tf_backend",
        "//tensorboard/components_polymer3/tf_dashboard_common",
        "//tensorboard/components_polymer3/tf_globals",
        # TODO: Re-enable when paginated view store ready
        #"//tensorboard/components_polymer3/tf_paginated_view",
        "//tensorboard/components_polymer3/tf_storage",
        "@npm//@polymer/decorators",
        "@npm//@polymer/iron-icons",
        "@npm//@polymer/paper-button",
        "@npm//@polymer/paper-checkbox",
        "@npm//@polymer/paper-dialog",
        "@npm//@polymer/paper-header-panel",
        "@npm//@polymer/paper-icon-button",
        "@npm//@polymer/paper-listbox",
        "@npm//@polymer/paper-tabs",
        "@npm//@polymer/paper-toolbar",
        "@npm//@polymer/polymer",
        "@npm//@types/lodash",
        "@npm//lodash",
    ],
)

tf_ts_library(
    name = "registry",
    srcs = [
        "registry.ts",
    ],
    strict_checks = False,
    visibility = ["//visibility:public"],
)

tf_ts_library(
    name = "plugin_dialog",
    srcs = [
        "plugin-dialog.ts",
    ],
    strict_checks = False,
    deps = [
        "@npm//@polymer",
        "@npm//@types/lodash",
        "@npm//lodash",
    ],
)

tf_ts_library(
    name = "default_plugins",
    srcs = ["default-plugins.ts"],
    strict_checks = False,
    deps = [
        # TODO: Uncomment each once ready.
        # "//tensorboard/plugins/audio/polymer3/tf_audio_dashboard",
        # "//tensorboard/plugins/custom_scalar/polymer3/tf_custom_scalar_dashboard",
        # "//tensorboard/plugins/debugger/polymer3/tf_debugger_dashboard",
        # "//tensorboard/plugins/distribution/polymer3/tf_distribution_dashboard",
        # "//tensorboard/plugins/graph/polymer3/tf_graph_dashboard",
        # "//tensorboard/plugins/histogram/polymer3/tf_histogram_dashboard",
        # "//tensorboard/plugins/hparams/polymer3/tf_hparams_dashboard",
        # "//tensorboard/plugins/image/polymer3/tf_image_dashboard",
        # "//tensorboard/plugins/mesh/polymer3/tf_mesh_dashboard",
        # "//tensorboard/plugins/pr_curve/polymer3/tf_pr_curve_dashboard",
        # "//tensorboard/plugins/profile_redirect/polymer3/tf_profile_redirect_dashboard",
        # "//tensorboard/plugins/scalar/polymer3/tf_scalar_dashboard",
        # "//tensorboard/plugins/text/polymer3/tf_text_dashboard",
    ],
)
