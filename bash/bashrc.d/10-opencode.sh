# Default models
export OC_MODEL="routerai/deepseek/deepseek-v4.1-flash-1017"
export OC_REVIEW_MODEL="routerai/z-ai/glm-5.3"
export OC_CODER_MODEL="routerai/deepseek/deepseek-v4.1-flash-1017"
export OC_EXPLORE_MODEL="routerai/deepseek/deepseek-v4.1-flash-1017"
export OC_VISION_MODEL="routerai/xiaomi/mimo-v2.6-flash"
export OC_TITLE_MODEL="routerai/xiaomi/mimo-v2.6-flash"

# _oc <model> <review> <coder> <explore> <vision> <title> [opencode args...]
# Subshell so the exported models only apply to this launch.
_oc() {
    local m="$1" r="$2" c="$3" e="$4" v="$5" t="$6"
    shift 6
    (
        export OC_MODEL="$m" OC_REVIEW_MODEL="$r" OC_CODER_MODEL="$c" \
               OC_EXPLORE_MODEL="$e" OC_VISION_MODEL="$v" OC_TITLE_MODEL="$t"
        opencode "$@"
    )
}

oc-rtai() {
    _oc \
        "routerai/deepseek/deepseek-v4.1-flash-1017" \
        "routerai/z-ai/glm-5.3" \
        "routerai/deepseek/deepseek-v4.1-flash-1017" \
        "routerai/deepseek/deepseek-v4.1-flash-1017" \
        "routerai/xiaomi/mimo-v2.6-flash" \
        "routerai/xiaomi/mimo-v2.6-flash" "$@"
}

oc-ltlm() {
    _oc \
        "litellm/grok-4.7" \
        "litellm/or-glm-5.3" \
        "litellm/grok-4.7" \
        "litellm/grok-4.7" \
        "litellm/or-mimo-v2.5" \
        "litellm/or-mimo-v2.5" "$@"
}

oc-oprt() {
    _oc \
        "openrouter/deepseek/deepseek-v4.1-flash" \
        "openrouter/z-ai/glm-5.3" \
        "openrouter/deepseek/deepseek-v4.1-flash" \
        "openrouter/deepseek/deepseek-v4.1-flash" \
        "openrouter/xiaomi/mimo-v2.6-flash" \
        "openrouter/xiaomi/mimo-v2.6-flash" "$@"
}
