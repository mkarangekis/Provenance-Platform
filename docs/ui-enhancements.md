# UI Enhancements

This document captures the UI polish work across the dashboard, objects list, object detail, and settings pages.
It also documents the shared loading states, animation hooks, and mobile responsiveness updates.

## Shared Patterns

- `animate-fade-in` class (defined in `src/app/globals.css`) for soft entrance transitions.
- Loading skeletons use `animate-pulse` with neutral card blocks for a consistent shimmer.
- Cards support subtle lift on hover with `transition-all` and `hover:-translate-y-1`.

## Page Updates

### Dashboard (`src/app/dashboard/page.tsx`)

- Added animated stat cards with staggered delays.
- Enhanced hero header layout for mobile and desktop.
- Improved "Create New Object" form layout with helper text.
- Added skeleton loading layout for header, stats, and cards.

### Objects List (`src/app/objects/page.tsx`)

- Added summary counts in the header and filter chip display.
- Refined filter card with labels for status and sort.
- Added preview panel placeholder inside cards for visual rhythm.
- Introduced skeleton loading states and card entrance animations.

### Object Detail (`src/app/objects/[id]/page.tsx`)

- Reworked header to be responsive and added a mobile quick stats strip.
- Rebuilt overview tab into a two-column layout with quick actions.
- Added animation to timeline events, documents, and AI extraction entries.
- Improved timeline spacing on small screens.
- Added loading skeleton for header and content areas.

### Settings (`src/app/settings/page.tsx`)

- Added a gradient header and organized cards into responsive columns.
- Added skeleton loading states for team members and audit log sections.
- Made member rows and pending invites responsive for narrow screens.
- Added helper copy for roles and admin permissions.

## Mobile Responsiveness

- The AppShell sidebar now overlays the page on small screens and uses a dismiss overlay.
- Headers and action rows across pages switch to stacked layouts on narrow viewports.
- Button groups use `flex-col` and full-width buttons where needed.

## Animation Hooks

- `src/app/globals.css` defines `animate-fade-in` for shared use.
- Apply staggered animation delays with inline `style={{ animationDelay: '80ms' }}`.
- Prefer short durations (under 400ms) for responsiveness.
