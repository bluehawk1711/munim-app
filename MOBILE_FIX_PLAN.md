# Munim Mobile App — Complete UI/UX, Responsiveness, Feature Parity & Performance Fix

You are working on the **Munim monorepo**, where the mobile app is `apps/mobile` and uses **React Native 0.86 + Expo SDK 57**. The mobile app is one of three clients sharing the same NestJS API, `@munim/api-client`, `@munim/query`, `@munim/store`, `@munim/core`, and theme system. Do not break the existing shared architecture or duplicate business logic.

The goal is to perform a **complete mobile UI/UX and responsiveness overhaul**, while also restoring **full feature parity with the web and desktop applications**.

Do not make superficial styling changes. Audit the entire mobile application and fix the underlying layout, component, keyboard, modal, navigation, caching, and form problems systematically.

---

## 1. First: audit the entire mobile application

Before changing anything:

* Inspect the complete `apps/mobile` implementation.
* Inspect the corresponding web and desktop implementations for every affected feature.
* Compare mobile forms and workflows against web/desktop to identify missing fields, missing actions, missing validation, missing selectors, and missing functionality.
* Reuse existing shared business logic and API/query hooks.
* Do **not** reimplement business logic inside mobile.
* Do not introduce platform-specific data fetching that bypasses `@munim/query`.
* Preserve the existing shared theme and design tokens rather than hardcoding colors. The theme package is the single source of truth for all three platforms.
* Follow the repository's existing architecture and type-safety rules.

The feature matrix currently states that mobile should have the same major modules as web and desktop, including Products, Sales, Billing, Job Letters, Parties/Khata, Advances, Reports, Invoices, Settings, Catalog, barcode functionality, labels, and dashboard functionality. Treat that matrix as the expected baseline and fix any actual implementation gaps you discover.

---

# 2. Install and integrate the required mobile UI libraries

Add these dependencies to `apps/mobile`:

```bash
pnpm install react-native-animatable --save

npx expo install \
  react-native-reanimated-carousel \
  react-native-reanimated \
  react-native-worklets \
  react-native-gesture-handler

pnpm add @gorhom/bottom-sheet@^5
```

Use the libraries properly rather than installing them and leaving them unused.

Required usage:

* `@gorhom/bottom-sheet` → all bottom sheets
* `react-native-reanimated-carousel` → appropriate horizontal/carousel experiences
* `react-native-reanimated` + `react-native-worklets` → animations and interactions
* `react-native-animatable` → lightweight entrance/transition animations where appropriate
* FlashList → high-performance large lists

After adding native dependencies, verify Expo configuration and imports are correct and ensure the app still builds correctly. The repository already notes that native module changes require a mobile dev-build rebuild.

---

# 3. Replace ALL existing bottom-sheet implementations

Introduce a **single reusable bottom-sheet system** based on:

```text
@gorhom/bottom-sheet
```

Create a reusable component/abstraction for Munim, for example:

```text
components/ui/BottomSheet.tsx
components/ui/BottomSheetModal.tsx
components/ui/BottomSheetContent.tsx
```

Use the appropriate Gorhom APIs consistently.

Then migrate **every existing custom bottom sheet / modal sheet / action sheet** in the mobile application to this system.

The new bottom sheet must support:

* dynamic height
* snap points
* safe-area handling
* keyboard-aware behavior
* Android keyboard handling
* iOS keyboard handling
* scrolling content
* forms
* action buttons
* headers
* close buttons
* drag indicator
* backdrop
* proper dismissal behavior
* nested scrolling where necessary
* large content
* landscape/small-screen handling
* accessibility
* dark/light themes

No important button should ever be pushed outside the viewport.

Bottom sheets must behave correctly when:

* keyboard is hidden
* keyboard is visible
* content is short
* content is long
* device has a small display
* device has a large display
* Android keyboard resize mode changes
* user rotates the device

Do not simply reduce font size to make layouts fit.

---

# 4. Fix keyboard + dialog responsiveness globally

Currently many dialogs/sheets become broken when the keyboard opens.

Fix the root problem rather than patching individual screens.

Create consistent primitives for:

* KeyboardAvoidingView behavior
* scrollable form content
* bottom action/footer areas
* safe-area insets
* dynamic modal height
* keyboard offset
* focused input visibility

Required behavior:

```text
Header
↓
Scrollable Form Content
↓
Flexible Spacer
↓
Primary / Secondary Actions
↓
Safe Area
```

The action buttons must remain reachable above the keyboard.

Never allow:

* buttons to render outside the screen
* buttons to be hidden behind the keyboard
* fields to become impossible to scroll to
* modal content to overflow horizontally
* fixed-height forms that break on small devices
* headers or footers to overlap fields
* text to be clipped
* close buttons to disappear

Apply this consistently to **every dialog, sheet, form and confirmation UI**.

---

# 5. Introduce a responsive mobile layout system

Audit all screens for inconsistent sizing.

Create reusable responsive primitives/utilities where useful:

* spacing scale
* typography scale
* responsive horizontal padding
* responsive card sizing
* responsive button heights
* input sizing
* modal sizing
* screen gutters
* safe-area padding

Avoid arbitrary pixel values scattered throughout screens.

Typography must remain readable and appropriately scaled across different device widths.

Every screen should work properly on:

* small Android phones
* standard Android phones
* large Android phones
* iPhones with notches
* iPhones with Dynamic Island
* devices with gesture navigation
* devices with three-button Android navigation

Use `useSafeAreaInsets()` and responsive dimensions where required.

---

# 6. Product list redesign

The current product cards contain too much information and do not behave well on mobile.

Redesign them.

Create a dedicated reusable:

```text
ProductAccordionCard
```

The default collapsed state should show only the most useful information.

Example collapsed layout:

```text
┌────────────────────────────────────┐
│ [Image] Product Name         ⋮     │
│         SKU / Barcode              │
│         ₹ Sell Price     Stock     │
└────────────────────────────────────┘
```

Add a **three-dot menu** on the right side.

The three-dot menu should expose appropriate actions such as:

* Edit
* Adjust Stock
* Delete
* Print Label
* Barcode actions
* Other existing product actions

Do not duplicate actions unnecessarily between the accordion and the three-dot menu.

Expanded state can reveal:

* full product information
* buy price
* sell price
* stock
* color
* size
* category
* SKU
* barcode
* weight
* additional metadata
* image/details
* available actions

Use smooth Reanimated animations.

Only one or a small controlled number of cards should be expanded at a time to prevent huge layouts.

Use **FlashList** for the product list.

Do not use `ScrollView + map()` for a large product collection when FlashList is appropriate.

The list must remain smooth with hundreds or thousands of products.

---

# 7. Product selection in Sales

The current product-selection experience in Sales is visually poor.

Redesign the workflow from the user's perspective.

The primary action to **Add Product** must be clearly positioned and immediately discoverable.

Use a layout such as:

```text
Sales
─────────────────────────
Customer
Search / Select Product
─────────────────────────

Selected Products
┌───────────────────────┐
│ Product               │
│ Qty   Price   Total   │
└───────────────────────┘

─────────────────────────
Subtotal
Discount
Total
─────────────────────────

[ Add Product ]

[ Complete Sale ]
```

The Add Product action must not compete visually with secondary actions.

The product picker should provide:

* search
* barcode lookup
* product thumbnail
* name
* SKU
* price
* stock
* variant information
* clear selection
* quantity
* appropriate empty state
* loading state
* error state

Use the existing barcode functionality and shared business logic rather than creating another implementation. Mobile already supports camera barcode scanning and manual barcode lookup.

Use the new BottomSheet for product selection where appropriate.

---

# 8. Home/dashboard redesign

The home screen currently places all **6 dashboard cards in one horizontal line**, which is poor mobile UX.

Redesign the dashboard cards into a responsive layout.

For example:

```text
┌───────────────┐ ┌───────────────┐
│ Revenue       │ │ Profit        │
│ ₹xxxx         │ │ ₹xxxx         │
└───────────────┘ └───────────────┘

┌───────────────┐ ┌───────────────┐
│ Receivables   │ │ Payables      │
│ ₹xxxx         │ │ ₹xxxx         │
└───────────────┘ └───────────────┘

┌───────────────┐ ┌───────────────┐
│ Low Stock     │ │ Pending       │
│ xx items      │ │ xx invoices   │
└───────────────┘ └───────────────┘
```

Do not force six cards into one row.

Use responsive 1-column/2-column behavior according to available width.

Cards should have:

* clear hierarchy
* appropriate icon
* title
* primary metric
* supporting information
* sensible number formatting
* consistent height
* proper spacing

Do not make every card unnecessarily large.

---

# 9. Loading and caching problems

A major issue currently exists where pages repeatedly display loading skeletons even when the API data should already be cached.

The project architecture already uses:

```text
@munim/query
TanStack Query
Zustand
```

and the architecture explicitly requires screens to consume shared TanStack Query hooks rather than calling the API client directly.

Audit the mobile implementation and fix caching properly.

Requirements:

* Reuse the shared TanStack Query layer.
* Do not create duplicate query clients.
* Ensure a stable `QueryClient` lifecycle.
* Configure sensible `staleTime`.
* Configure sensible `gcTime`.
* Avoid unnecessary refetches on screen focus.
* Avoid unnecessary refetches after navigation.
* Deduplicate identical requests.
* Preserve cached data while fetching fresh data.
* Use `placeholderData` / previous data where appropriate.
* Show skeletons only when there is genuinely no usable cached data.
* If cached data exists, immediately render cached content while refreshing in the background.
* Avoid flashing loading states during normal navigation.

Desired behavior:

```text
First visit
→ skeleton
→ data

Navigate away
→ cached data remains

Return to screen
→ immediately show cached data
→ background refresh if stale

Mutation
→ update/invalidate correct query
→ UI updates without unnecessary full-screen loading
```

Do not solve this by disabling all fetching.

Caching must remain correct and data must eventually refresh.

---

# 10. FlashList migration

Identify every large/medium data-heavy list in mobile and migrate suitable screens to FlashList.

Priority screens:

* Products
* Sales
* Invoices
* Parties
* Advances
* Reports where applicable
* Catalog
* any other potentially large collection

Ensure:

* stable keys
* optimized item components
* no unnecessary re-renders
* memoized row/card components
* appropriate estimated item sizes
* correct nested scrolling strategy
* animations do not destroy list performance

Do not overuse FlashList for tiny static lists where a normal layout is simpler.

---

# 11. Parties & Khata

The Parties/Khata screen currently has responsiveness problems.

Fix the ledger UI completely.

The ledger dialog/sheet must contain:

```text
Header
Party Name
Current Balance
Ledger Entries

[ Check History ]

[ Close ]
```

The following actions must be clearly visible:

* Close
* Check History
* appropriate ledger actions
* advance/payment actions where applicable

The UI must remain usable when the keyboard is open.

Ledger entries should have:

* date
* type
* amount
* direction
* running balance where appropriate
* clear visual distinction between money given/taken and payments

Use the existing shared ledger/khata business logic. The core already owns khata/ledger calculations and shared workflows.

---

# 12. Advances screen

The Advances screen is currently not responsive enough.

Redesign it to match the quality of the web/desktop experience while remaining native to mobile.

Mobile should clearly communicate:

```text
Money Overview
────────────────────

You will receive
₹XXXX

You will pay
₹XXXX

Net
₹XXXX

────────────────────

Quick Record
[ Select Party ]
[ Given / Taken ]
[ Amount ]
[ Record ]

────────────────────

Receivables
[ Party cards ]

Payables
[ Party cards ]
```

Cards must be compact and responsive.

Do not use desktop-sized card layouts on mobile.

Action buttons must remain visible and reachable.

Bottom sheets must be used for complex actions where appropriate.

---

# 13. Job Letter — restore missing form fields

The mobile Job Letter form is missing multiple inputs compared with the web/desktop implementation.

Do a direct parity comparison between:

```text
apps/web
apps/desktop
apps/mobile
```

and implement every missing mobile field.

Do not guess which fields should exist.

Use the actual web/desktop Job Letter form as the source of truth.

The repository states that Job Letters are a full feature across all three platforms and share `JobLetterData` / `renderJobLetterHtml`.

Ensure:

* every required field exists
* labels match the established terminology
* validation matches the other platforms
* optional fields remain optional
* all stored data is persisted
* generated PDFs contain the entered information
* edit functionality contains the same fields
* keyboard scrolling works properly

---

# 14. Product Create/Edit — restore missing selectors

The Product Create/Edit form is missing important selectors.

Implement proper selectors for:

* Color
* Size
* Category

Do not convert these into manually typed strings when the existing catalog/category data is available.

Use the existing catalog management and shared services.

The feature matrix confirms that colors and sizes are already a shared catalog feature across all three platforms.

The product form should support:

```text
Product Name
Category        [ Select ▾ ]
Color           [ Select ▾ ]
Size            [ Select ▾ ]
SKU
Barcode
Buy Price
Sell Price
Stock
Weight
Image
...
```

Ensure these selectors work inside a keyboard-open form.

Use a BottomSheet picker where it improves mobile usability.

---

# 15. Full form parity audit

This is critical.

Go through **every mobile form** and compare it with the equivalent web and desktop form.

Do not only fix the forms explicitly mentioned above.

Audit at minimum:

* Product Create
* Product Edit
* Sales
* Billing
* Invoice
* Record Payment
* Parties
* Ledger
* Advances
* Job Letters
* Catalog
* Stock Adjustment
* Reports
* Settings
* Connection/Onboarding
* any other forms/dialogs/sheets

For every form verify:

* all fields exist
* field names match
* validation matches
* required/optional states match
* selectors exist
* date selection exists
* notes fields exist
* party linking exists
* actions exist
* delete/edit functionality exists
* loading states exist
* error states exist
* success feedback exists

Do not intentionally remove functionality to simplify mobile UI.

Instead, reorganize it into collapsible sections, accordions, bottom sheets, progressive disclosure, or scrollable forms.

---

# 16. Billing and invoice UX

The mobile billing experience must retain the feature parity already expected by the project.

Do not regress:

* customer name
* phone
* address
* party linking
* date
* notes/terms
* discounts
* delivery
* payment status
* template selection
* classic color selection
* 2-in-1 billing
* duplicate/separate behavior
* second-bill editor
* payment recording

These are already defined as expected mobile functionality.

Improve the layout without removing functionality.

---

# 17. Typography and spacing system

Perform a complete typography audit.

Fix:

* headings too large
* headings too small
* inconsistent font weights
* cramped labels
* inconsistent line heights
* clipped text
* buttons with poor text alignment
* cards with excessive vertical padding
* inconsistent section spacing
* poor numeric hierarchy

Use a consistent hierarchy such as:

```text
Screen Title
Section Title
Card Title
Primary Value
Secondary Value
Label
Supporting Text
Caption
```

Do not randomly change font sizes screen-by-screen.

Create reusable typography styles/primitives where appropriate.

---

# 18. Buttons and touch targets

Every interactive element must be properly touchable.

Ensure:

* primary actions are visually dominant
* destructive actions are visually distinct
* secondary actions don't overpower primary actions
* buttons have appropriate minimum touch targets
* icons have adequate hit areas
* icon-only buttons have accessibility labels
* close buttons are always reachable
* three-dot menus are easy to tap
* forms do not have tiny controls

Avoid putting multiple competing primary buttons next to each other on narrow screens.

---

# 19. Navigation and information architecture

Review every screen's navigation.

Mobile should feel like a dedicated mobile application rather than a desktop UI squeezed into a phone.

Use:

* bottom navigation for primary destinations
* More/overflow for secondary modules
* bottom sheets for contextual actions
* accordions for dense data
* full-screen screens for complex workflows
* compact cards
* progressive disclosure

Do not create excessive nested navigation.

Ensure users always know:

* where they are
* what the primary action is
* how to go back
* how to close a sheet/dialog
* how to cancel an operation

---

# 20. Animation and interaction quality

Use animation intentionally.

Use:

```text
react-native-reanimated
react-native-worklets
react-native-animatable
```

for:

* accordion expansion
* card transitions
* sheet transitions
* button feedback
* screen entrances
* list item appearance
* dashboard card transitions
* theme-related interactions where appropriate

Use `react-native-reanimated-carousel` where a carousel genuinely improves UX.

Animations must be:

* fast
* subtle
* consistent
* interruptible
* performance-friendly

Do not animate everything.

Respect reduced-motion preferences where practical.

---

# 21. Empty, loading and error states

Every major screen needs proper states:

### Loading

Show skeleton only when there is no cached data.

### Cached refresh

Show current content while refreshing silently.

### Empty

Explain what is empty and provide a useful CTA.

### Error

Show a friendly error state with retry.

### Mutation

Show localized action feedback rather than replacing the whole page with a loading screen.

Do not use a generic full-screen spinner for every operation.

---

# 22. Performance requirements

After the redesign:

* Avoid unnecessary API requests.
* Avoid duplicate queries.
* Avoid duplicate query clients.
* Avoid full-screen loading on cached navigation.
* Use FlashList where appropriate.
* Memoize expensive list rows.
* Avoid anonymous heavy callbacks in huge lists when it impacts rendering.
* Avoid unnecessary state at screen level.
* Avoid rendering hidden modal content when unnecessary.
* Keep animations on the UI thread where possible.
* Avoid expensive calculations inside render functions.
* Avoid rendering thousands of unnecessary components.
* Maintain smooth scrolling.

---

# 23. Visual consistency

All mobile UI must follow the existing Munim theme system.

Do not introduce random colors.

Use:

```text
@munim/theme
```

through the existing mobile theme system.

The mobile theme system already maps shared theme tokens into React Native colors, including background, card, text, muted, border, primary, success, danger and warning colors.

Preserve all existing theme variants:

* Apple
* Ocean
* Forest
* Rose
* Midnight

and both light/dark modes.

Every newly created component must support all themes automatically.

---

# 24. Do not break existing functionality

The following functionality must continue working after the redesign:

* API communication
* authentication/API-key configuration
* cached queries
* mutations
* product CRUD
* stock adjustments
* product images
* barcode generation
* barcode scanning
* label printing
* sales
* invoices
* payments
* billing
* job letters
* parties
* khata
* advances
* reports
* settings
* theme switching
* PDF generation
* native sharing

The project explicitly uses the NestJS API as the shared backend and mobile communicates through the shared API client. Do not introduce direct Neon/database access into the mobile application.

---

# 25. Implementation strategy

Work systematically rather than fixing random individual screens.

### Phase 1 — Foundation

Create/rework:

* responsive layout utilities
* typography primitives
* responsive cards
* Button primitives
* Input primitives
* Select/Picker primitives
* BottomSheet system
* keyboard-aware form container
* modal/sheet action footer
* responsive section/card components
* FlashList wrapper if useful

### Phase 2 — Data/performance

Fix:

* QueryClient lifecycle
* TanStack Query cache configuration
* stale times
* refetch behavior
* mutation invalidation
* cached navigation
* loading-state logic
* list performance

### Phase 3 — High-priority screens

Redesign:

1. Home
2. Products
3. Sales
4. Parties/Khata
5. Advances

### Phase 4 — Forms

Audit and fix:

1. Product
2. Job Letter
3. Sales
4. Billing
5. Invoice
6. Parties
7. Advances
8. Reports
9. Settings
10. all remaining forms

### Phase 5 — Global polish

Fix:

* typography
* spacing
* animations
* safe areas
* keyboard handling
* empty states
* loading states
* error states
* accessibility
* touch targets

---

# 26. Acceptance criteria

Do not consider the task complete until all of the following are true:

### Responsive UI

* No button is outside the viewport.
* No dialog is clipped.
* No bottom sheet is broken by the keyboard.
* No horizontal overflow exists.
* Forms can always be scrolled to the focused field.
* Close actions are always visible/reachable.

### Products

* Product cards are compact.
* Product cards use accordion behavior.
* Three-dot action menu exists.
* Product lists use FlashList.
* Product create/edit has Color, Size and Category selectors.
* Existing product functionality remains intact.

### Sales

* Product selection is visually clean.
* Add Product action is properly positioned.
* Product picker works smoothly.
* Search and barcode flows work.
* Sale form works with keyboard open.

### Dashboard

* Six cards no longer occupy one row.
* Layout adapts to screen width.
* Cards have clear visual hierarchy.

### Parties / Khata

* Ledger UI is responsive.
* Close button exists.
* Check History exists.
* Ledger content scrolls correctly.
* Keyboard does not break the sheet.

### Advances

* Summary is responsive.
* Party picker works.
* Given/Taken flow works.
* Cards and actions fit correctly.
* Keyboard does not break forms.

### Job Letters

* Mobile has complete field parity with web/desktop.
* Every persisted field can be edited.
* Generated output includes entered data.

### Performance

* Cached pages render immediately.
* Skeletons do not flash when usable cached data exists.
* Background refresh works.
* Lists remain smooth.
* API calls are deduplicated.
* No unnecessary refetching occurs.

### Component architecture

* All bottom sheets use the new Gorhom BottomSheet system.
* Common responsive behavior is implemented through reusable components.
* No duplicated business logic is introduced.
* Existing shared query/state/API architecture is preserved.
* Shared theme tokens are respected.

---

# 27. Final verification

After implementation:

1. Run TypeScript/type checking.
2. Run linting.
3. Run the mobile build.
4. Check Android behavior.
5. Check iOS-compatible layout assumptions.
6. Test with keyboard open and closed.
7. Test small and large screen dimensions.
8. Test light and dark mode.
9. Test all five themes.
10. Test cached navigation between screens.
11. Test long lists.
12. Test empty/loading/error states.
13. Test every major form.
14. Verify no existing feature regressed.
15. Compare mobile functionality against web/desktop again after the changes.

Do not mark a feature as fixed merely because it compiles. The actual UX must be tested against the acceptance criteria.

---

## Important engineering rule

**Prioritize correctness, responsiveness, feature parity, and maintainability over making the code change as small as possible.**

Do not create hacks such as:

* arbitrary negative margins
* fixed heights that only work on one device
* hidden buttons
* hardcoded keyboard offsets
* duplicated API logic
* duplicated business logic
* fake placeholder fields
* desktop layouts squeezed into mobile
* disabling caching to hide loading problems

Fix the underlying architecture and create reusable primitives so that the improvements automatically benefit the rest of the mobile application.
