---
name: Obsidian Kinetic
colors:
  surface: '#131317'
  surface-dim: '#131317'
  surface-bright: '#39393e'
  surface-container-lowest: '#0e0e12'
  surface-container-low: '#1b1b20'
  surface-container: '#1f1f24'
  surface-container-high: '#2a292e'
  surface-container-highest: '#353439'
  on-surface: '#e4e1e8'
  on-surface-variant: '#c3c5d7'
  inverse-surface: '#e4e1e8'
  inverse-on-surface: '#303035'
  outline: '#8d90a0'
  outline-variant: '#434654'
  surface-tint: '#b5c4ff'
  primary: '#b5c4ff'
  on-primary: '#00297b'
  primary-container: '#648aff'
  on-primary-container: '#00236d'
  inverse-primary: '#1a53d6'
  secondary: '#cabeff'
  on-secondary: '#31009a'
  secondary-container: '#4816cb'
  on-secondary-container: '#b9aaff'
  tertiary: '#23e373'
  on-tertiary: '#003917'
  tertiary-container: '#00a750'
  on-tertiary-container: '#003113'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dce1ff'
  primary-fixed-dim: '#b5c4ff'
  on-primary-fixed: '#00164d'
  on-primary-fixed-variant: '#003cad'
  secondary-fixed: '#e6deff'
  secondary-fixed-dim: '#cabeff'
  on-secondary-fixed: '#1c0062'
  on-secondary-fixed-variant: '#4816cb'
  tertiary-fixed: '#64ff92'
  tertiary-fixed-dim: '#23e373'
  on-tertiary-fixed: '#00210b'
  on-tertiary-fixed-variant: '#005224'
  background: '#131317'
  on-background: '#e4e1e8'
  surface-variant: '#353439'
typography:
  display-xl:
    fontFamily: Inter
    fontSize: 56px
    fontWeight: '700'
    lineHeight: 64px
    letterSpacing: -0.03em
  display-xl-mobile:
    fontFamily: Inter
    fontSize: 38px
    fontWeight: '700'
    lineHeight: 46px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
  caption:
    fontFamily: Inter
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 12px
    letterSpacing: 0.05em
rounded:
  sm: 0.5rem
  DEFAULT: 1rem
  md: 1.5rem
  lg: 2rem
  xl: 3rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-sm: 1rem
  margin: 2rem
  margin-sm: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system embodies an authoritative, high-density analytical workspace built for founders, venture analysts, and operators evaluating market demand and real-time intelligence. The aesthetic merges corporate clarity with high-performance telemetry: deep midnight canvases, precision hairline dividers, and controlled cobalt luminescence.

The visual style is a hybrid of Modern Technical Minimalism and Glassmorphism. Deep, low-reflectance surfaces eliminate visual noise across data-dense matrices, while luminous cobalt accents guide decision paths and key metrics. The experience prioritizes quiet confidence, razor-sharp focus, and zero decorative excess.

## Colors

The palette is engineered specifically for deep-dark displays to maximize typographic contrast and minimize ocular fatigue during extended working sessions.

- **Canvas & Backgrounds:** The core backdrop relies on an ultra-deep black `#07070B`, transitioning to `#0B0B14` for primary app framing. Elevated containers utilize `#12121A` and `#161622`.
- **Primary & Interactive:** Focused energy is driven by the seed `#4F7CFF` (Cobalt) paired with `#7C5CFF` (Electric Violet). Gradients across primary calls-to-action move strictly along a 135-degree vector from `#7C5CFF` to `#4F7CFF`.
- **Validation & Signals:** Affirmative market signals, growth indicators, and telemetry validations leverage `#38EF7D` (Emerald Neon). Warning metrics resolve to `#F59E0B`, while negative trajectories or deletions use `#FF4B55`.
- **Text & Structure:** Primary headlines use crisp white `#F4F4F8`. Secondary copy, descriptions, and labels sit in muted lavender-slate `#9E9EB8` and tertiary `#63637E`. Hairline borders leverage transparent white strokes from `rgba(255, 255, 255, 0.08)` to `rgba(255, 255, 255, 0.12)`.

## Typography

Typography relies entirely on the Inter typeface family to deliver unmatched legibility across varying densities of tabular and analytical data. 

- **Display & Headings:** Tight letter tracking (`-0.01em` to `-0.03em`) produces an architectural, modern posture. Headings retain bold or semibold weights with strictly controlled line heights to maximize vertical dashboard real estate.
- **Body & Analytics:** Body layers are locked to neutral tracking, rendered in `#9E9EB8` to establish clear optical hierarchy below bold headlines.
- **Labels & Micro-copy:** Uppercase or high-contrast labels utilize small optical sizes (`10px` to `11px`) with open tracking (`+0.04em` to `+0.05em`) to ensure instant recognition on dense metric cards and badge indicators.

## Layout & Spacing

The layout is grounded in a fluid 12-column grid system paired with modular bento structures. 

- **Grid Architecture:** 12 columns on desktop (breakpoints > 1200px) with `2rem` margins and `1.5rem` gutters. Tablet views (768px – 1199px) adapt to an 8-column layout with `1rem` gutters. Handheld devices (< 768px) collapse into a 4-column flow with `1rem` outer margins.
- **Rhythm:** Spacing tokens govern interior component padding and intra-widget margins strictly along a 4px/8px incremental cadence. Dense metrics and inline key-value pairs adhere to `space-xs` and `space-sm`, while widget sections separate along `space-lg` and `space-xl` thresholds.

## Elevation & Depth

Spatial separation relies on subtle surface gradations, frosted glass properties, and targeted light emissions rather than heavy drop shadows:

- **Level 0 (Base Canvas):** Solid background `#07070B` overlayed with a subtle, low-opacity (2–3%) dot matrix or 32px cross-grid texture.
- **Level 1 (Bento Containers):** Background fill `#12121A` at 85% opacity with a `16px` backdrop-blur filter and a 1px border stroke of `rgba(255, 255, 255, 0.08)`.
- **Level 2 (Interactive Floating Cards & Dropdowns):** Background fill `#161622` at 95% opacity, backdrop blur `24px`, with a hairline border of `rgba(255, 255, 255, 0.14)`. Accompanied by an ambient shadow: `0 12px 32px -8px rgba(0, 0, 0, 0.75)`.
- **Level 3 (Focused & Active Accents):** Directional radial bloom of `rgba(79, 124, 255, 0.15)` bleeding behind key interactive nodes, anchored by an inner border illumination of `rgba(124, 92, 255, 0.4)`.

## Shapes

The geometric posture of this design system combines organic encapsulation with crisp containment:

- **Micro and Interactive Elements:** Buttons, chips, status pills, search bars, and filter toggles leverage full pill geometry (`roundedness: 3`, or `9999px`) to create tactile, distinct interactive touchpoints.
- **Macro Containers:** Bento cards, modal dialogs, and large analytic panels scale down to structured, unified container radii (20px to 24px) providing architectural stability while echoing the rounded pill aesthetic of internal controls.

## Components

### Buttons
- **Primary:** Full pill profile (`rounded: 9999px`), gradient background transitioning 135° from `#7C5CFF` to `#4F7CFF`. White text (`Inter`, semibold), zero border, supported by an ambient drop shadow `0 4px 16px rgba(79, 124, 255, 0.35)`. Hover state expands luminance and raises glow diffusion.
- **Secondary / Ghost:** Full pill profile, surface `#12121A` or transparent, 1px border `rgba(255, 255, 255, 0.12)`. Text `#F4F4F8`. Hover state transitions border to `rgba(255, 255, 255, 0.25)` and background to `#161622`.

### Chips & Badges
- Pill-shaped telemetry tags. Height 24px, padding 0 10px. Subtle frosted background `rgba(255, 255, 255, 0.04)` with a 1px matching hairline border. Status variations incorporate a 6px glowing indicator dot (e.g., `#38EF7D` for verified market evidence).

### Input Fields
- Capsule profile (`rounded: 9999px`) for single-line search and command palettes; 12px rounded container for multi-line inputs. Base fill `#0B0B14`, 1px border `rgba(255, 255, 255, 0.10)`. Focus shifts the border to `#4F7CFF` with a soft `0 0 0 3px rgba(79, 124, 255, 0.20)` external aura. Text typed in `#F4F4F8` with `#63637E` placeholder tint.

### Bento Cards & Panels
- Corner radius of 20px–24px. Translucent surface `#12121A` (85% opacity) with `backdrop-filter: blur(16px)` and 1px border `rgba(255, 255, 255, 0.08)`. Headers contain tight typography and thin geometric line icons (1.5px stroke width).

### Lists & Data Grids
- Alternating subtle hovers using `rgba(255, 255, 255, 0.02)`. Divider borders set strictly to 1px `rgba(255, 255, 255, 0.05)`. Metric cells align right with tabular figures enabled (`font-variant-numeric: tabular-nums`).

### Checkboxes & Radio Controls
- Radio controls are true circles; checkboxes leverage a 4px soft curve. 1px border in `rgba(255, 255, 255, 0.2)`. Active state fills with the primary gradient (`#7C5CFF` to `#4F7CFF`) displaying a crisp white micro-check or inner focal point.