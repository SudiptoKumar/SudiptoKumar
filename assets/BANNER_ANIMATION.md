# Banner animation

The banner uses two synchronized layers:

1. Dense portrait layer: the full Sudipto portrait remains visible during the portrait phase and fades smoothly during transitions.
2. Traveller layer: 900 dots morph between `SK`, `</>`, and `>_` using eased motion, then return to the portrait.

Timeline: 3.0s portrait, 1.3s transition, 2.0s logo, 1.3s transition, 2.0s logo, 1.3s transition, 2.0s logo, 1.3s return.

The intro runs once before the loop. The portrait layer is intentionally kept visible at the parent-group level; child opacity animation controls the dissolve. This prevents the portrait from disappearing after the intro.
