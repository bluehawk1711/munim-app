# Mobile App UI/UX Patterns

This document captures the UI/UX patterns used in the Munim mobile app for consistency and future reference.

## Table of Contents

1. [Color System](#color-system)
2. [Typography](#typography)
3. [Spacing & Layout](#spacing--layout)
4. [Components](#components)
5. [Modals & Sheets](#modals--sheets)
6. [Forms](#forms)
7. [Lists & Cards](#lists--cards)
8. [Feedback & Notifications](#feedback--notifications)
9. [Dark Mode](#dark-mode)
10. [Navigation](#navigation)

---

## Color System

### Theme Structure

The app uses a dynamic theme system with 5 accent themes:
- **Apple Gold** (default)
- **Ocean Blue**
- **Forest Green**
- **Rose Blush**
- **Midnight Indigo**

Each theme supports light and dark modes.

### Core Color Tokens

```typescript
interface MobileColors {
  bg: string;           // Background color
  card: string;         // Card background
  text: string;         // Primary text
  muted: string;        // Muted text
  mutedBg: string;      // Muted background (for pressed states)
  border: string;       // Border color
  primary: string;      // Primary action color
  accent: string;       // Accent/highlight color
  onPrimary: string;    // Text on primary
  success: string;      // Success states
  danger: string;       // Error/destructive states
  warning: string;      // Warning states
  successSoft: string;  // Success background
  warningSoft: string;  // Warning background
  dangerSoft: string;   // Danger background
  mutedSoft: string;    // Muted background for hover/press
  inputPlaceholder: string; // Input placeholder text
}
```

### Usage Guidelines

- **Always use theme colors** from `colors` object — never hardcode hex values
- Exception: Camera scanner overlay uses `#fff` and `#fca5a5` intentionally (black background)
- Toast messages use `#fff` for text on colored backgrounds

**❌ Wrong:**
```tsx
<Text style={{color: '#0c0b09'}}>Title</Text>
```

**✓ Correct:**
```tsx
<Text style={{color: colors.text}}>Title</Text>
```

---

## Typography

### Font Size Scale

```typescript
typography = {
  h1: 22,     // Screen title
  h2: 17,     // Modal title, section header
  h3: 15,     // Card title, subsection
  valueLarge: 20, // Large numbers (stats)
  body: 15,   // Primary body text
  secondary: 14, // Secondary text
  label: 12,  // Input labels
  caption: 11, // Captions, timestamps
  badge: 10,  // Badge text
  tab: 10,    // Tab labels
}
```

### Typography Usage

| Element | Size | Weight | Color |
|---------|------|--------|-------|
| Screen title | h1 (22) | 700 | text |
| Modal title | h2 (17) | 700 | text |
| Card title | h3 (15) | 700 | text |
| Body text | body (15) | 400-600 | text |
| Secondary | secondary (14) | 400 | muted |
| Labels | label (12) | 600 | muted |
| Caption | caption (11) | 400 | muted |
| Badge | badge (10) | 700 | varies |

---

## Spacing & Layout

### Spacing Scale

```typescript
spacing = {
  xs: 4,    // Tiny gaps
  sm: 8,    // Small gaps
  md: 12,   // Medium gaps
  lg: 16,   // Large gaps
  xl: 20,   // Extra large
  xxl: 24,  // Section spacing
  xxxl: 32, // Major section spacing
}
```

### Responsive Units

```typescript
// Horizontal values (scale with screen width)
rw(390) // Returns pixel value scaled to device width

// Vertical values
rh(844)

// Font size with pixel ratio
rFont(16)

// General size (border radius, icons)
rs(8)
```

### Layout Patterns

#### Card Layout
```tsx
<Card index={0}>
  {/* Content */}
</Card>
```
- Cards use `marginHorizontal: CARD_MARGIN` (16px) for screens
- Cards inside lists use `marginHorizontal: CARD_MARGIN`
- Grid cards use `marginHorizontal: 0` with `gap: GRID_GAP`

#### Screen Structure
```tsx
<Screen>
  <Header title="Title" subtitle="Optional subtitle" />
  {/* Content */}
</Screen>
```

#### Content Padding
- Screen content: No additional padding (header handles top)
- List content: `paddingBottom: spacing.xxxl` (for FAB)
- Card content: `padding: spacing.lg` (24px)

---

## Components

### Button

```tsx
<Button
  title="Button text"
  onPress={handlePress}
  variant="primary" | "outline" | "danger"
  size="default" | "small"
  loading={isLoading}
  disabled={isDisabled}
  icon={<Icon />}
/>
```

**Styles:**
- Primary: Solid primary color background
- Outline: Border with transparent background
- Danger: Red background for destructive actions
- Small: Reduced padding for inline use

### Field (Input)

```tsx
<Field
  label="Label text"
  value={value}
  onChangeText={setter}
  placeholder="Placeholder"
  keyboardType="numeric" | "email-address" | "phone-pad"
  multiline
  secureTextEntry
/>
```

**Styles:**
- Label above input (12px, muted, 600 weight)
- Input: 1px border, rounded (10px), card background
- Multiline: Min height 80px, top-aligned text

### SelectField

```tsx
<SelectField
  label="Label"
  value={selected}
  placeholder="Select…"
  onPress={openPicker}
/>
```

Shows chevron down icon, tap to open picker.

### Badge

```tsx
<Badge text="Status text" tone="success" | "warning" | "danger" | "muted" />
```

### Card

```tsx
<Card index={0} style={{marginHorizontal: CARD_MARGIN}}>
  {/* Content */}
</Card>
```

Animated entrance with FadeInDown.

### AccordionCard

```tsx
<AccordionCard
  expanded={isExpanded}
  onToggle={toggle}
  header={<HeaderContent />}
  trailing={<ThreeDotMenu />}
>
  {/* Expanded content */}
</AccordionCard>
```

### ThreeDotMenu

```tsx
<ThreeDotMenu
  actions={[
    {label: 'Edit', onPress: handleEdit},
    {label: 'Delete', onPress: handleDelete, destructive: true},
  ]}
/>
```

**Important:** Must have high z-index (9999) to appear above cards.

### Pressable

Use for custom interactive elements:
```tsx
<Pressable
  onPress={handlePress}
  hitSlop={8}
  style={({pressed}) => [
    baseStyle,
    pressed && {opacity: 0.7},
  ]}
>
  {/* Content */}
</Pressable>
```

---

## Modals & Sheets

### ModalSheet (Centered Modal)

All forms and pickers should use centered modals:

```tsx
<ModalSheet
  visible={isOpen}
  title="Modal title"
  onClose={() => setIsOpen(false)}
  dismissable={!isLoading}
  centered
  scrollable
>
  {/* Content */}
</ModalSheet>
```

**Props:**
- `centered`: Makes modal appear in center of screen (not bottom sheet)
- `scrollable`: Wraps content in ScrollView for long content
- `dismissable`: Allows closing by tapping outside (set false during loading)

### When to Use Centered vs Bottom Sheet

| Use Case | Pattern |
|----------|---------|
| Forms (add/edit) | Centered + scrollable |
| Pickers (select from list) | Centered + scrollable |
| Simple confirmations | Centered |
| Quick actions | Centered |

**All current screens use centered modals.**

### Modal Content Guidelines

1. **Title**: Always include a clear title
2. **Spacing**: Use `spacing.lg` (16px) padding inside modal
3. **Form fields**: `marginBottom: spacing.md` (12px) between fields
4. **Buttons**: Full width for primary actions
5. **Max height**: Modals have max 80% height, scrollable modals have max 400px for content

---

## Forms

### Form Layout Pattern

```tsx
<ModalSheet visible={formOpen} title="Add Product" centered scrollable>
  <Field label="Name" value={name} onChangeText={setName} />
  <Pressable style={styles.imagePicker}>
    {/* Image picker */}
  </Pressable>
  <SelectField label="Color" value={color} onPress={openColorPicker} />
  <Field label="Stock" value={stock} onChangeText={setStock} keyboardType="numeric" />
  <Button title="Save" onPress={handleSave} loading={saving} />
</ModalSheet>
```

### Form Field Spacing

- Between fields: `marginBottom: spacing.md` (12px)
- Image picker height: `rs(120)` (increased from 96 for better UX)
- Button margin top: Auto from last field

### Input Guidelines

- Always include label
- Use appropriate `keyboardType` for numeric/phone fields
- Use `placeholder` for guidance
- Use `multiline` for long text inputs

---

## Lists & Cards

### FlashList Usage

```tsx
<FlashList
  data={items}
  renderItem={renderItem}
  keyExtractor={item => item.id}
  contentContainerStyle={{padding: spacing.sm, paddingBottom: spacing.xxl}}
  keyboardShouldPersistTaps="handled"
  ListEmptyComponent={<Empty text="No items" />}
/>
```

### List Item Patterns

#### Simple Row
```tsx
<View style={styles.row}>
  <Text style={{flex: 1}}>{item.name}</Text>
  <Text>{item.value}</Text>
</View>
```

#### Row with Actions
```tsx
<View style={styles.row}>
  <View style={{flex: 1}}>
    <Text>{item.name}</Text>
  </View>
  <Button title="Action" variant="outline" size="small" />
</View>
```

#### Expandable Card (Accordion)
```tsx
<AccordionCard
  expanded={expandedId === item.id}
  onToggle={() => toggleExpand(item.id)}
  header={<HeaderContent />}
  trailing={<ThreeDotMenu actions={menuActions} />}
>
  {/* Expanded content */}
</AccordionCard>
```

**Important:** ThreeDotMenu must have `zIndex: 9999` and be positioned correctly to appear above the card.

### Empty States

```tsx
<Empty text="No products yet" />
// or with action
<Empty
  text="No products yet"
  action={{label: "Add product", onPress: openAdd}}
/>
```

### Error States

```tsx
<ErrorBox message={error} onRetry={reload} />
```

---

## Feedback & Notifications

### Toast Notifications

The app uses a toast system for visual feedback:

```tsx
// In screens, use the haptics functions with messages:
successFeedback('Product saved successfully');
errorFeedback('Failed to save product');
```

**Toast behavior:**
- Success: Green background, auto-dismisses after 3 seconds
- Error: Red background, auto-dismisses after 3 seconds
- Position: Bottom center of screen
- Can be dismissed by tapping

### Haptics

```tsx
import {successFeedback, errorFeedback, selectionTick, actionPress} from '../lib/haptics';

// Use throughout interactions
selectionTick();  // List row tap
actionPress();    // Button press
successFeedback('Message');  // After successful action
errorFeedback('Message');    // After failed action
```

### Loading States

```tsx
// Full screen loading
<Loading rows={5} />

// Button loading
<Button title="Saving…" loading={true} />

// Inline loading
<InlineSpinner text="Loading…" />
```

---

## Dark Mode

### Color Contrast Requirements

In dark mode, ensure all text has sufficient contrast:

| Background | Text Color | Use Case |
|------------|------------|----------|
| bg (dark) | text (light) | Primary content |
| card (dark) | text (light) | Card content |
| card (dark) | muted (gray) | Secondary text |

### Dark Mode Testing

1. Switch to dark mode in Settings
2. Check all screens for:
   - Text visibility (no hardcoded light colors on dark backgrounds)
   - Icon visibility
   - Border visibility
   - Button contrast

### Common Dark Mode Issues Fixed

1. **JobLettersScreen**: Changed hardcoded `#0c0b09` and `#7f7971` to `colors.text` and `colors.muted`
2. **Barcode in ProductsScreen**: Uses `showText: true` for better visibility
3. **ThreeDotMenu**: Uses theme colors, positioned with high z-index

---

## Navigation

### Tab Bar

6 tabs at bottom:
1. **Home** - Dashboard
2. **Stock** (Inventory) - Product management
3. **Sales** - Quick sales
4. **Bills** - Billing/invoicing
5. **Khata** - Parties & advances
6. **More** - Settings, reports, catalog, etc.

### Screen Titles

| Tab | Screen Title |
|-----|--------------|
| Home | "Munim" |
| Stock | "Inventory" |
| Sales | "Sales" |
| Bills | "Billing" |
| Khata | "Parties & Khata" |
| More | "More" |

### Navigation Patterns

- Tab bar uses animated indicator
- Screen transitions use FadeIn/FadeOut
- Back navigation in More sub-screens uses chevron button

---

## Common Patterns

### Product Picker (Used in Billing, Sales)

```tsx
function ProductPicker({products, productId, onSelect}) {
  // Searchable list of products
  // Shows product name, SKU, price
  // Optionally shows product image
  // On select: calls onSelect with product id and data
}
```

### Party Picker (Used in Billing)

```tsx
function PartyPicker({parties, partyId, onSelect}) {
  // List of parties with type badge
  // "None (walk-in)" option at top
  // On select: calls onSelect with party id and data
}
```

### Catalog Picker (Color/Size/Category)

```tsx
// Simple list of catalog items
// "Clear" option at bottom
// On select: updates form field and closes picker
```

---

## Accessibility

### Touch Targets

- Minimum touch target: 44x44pt (TOUCH_TARGET constant)
- Buttons: Min height 44pt
- Pressable items: Use `hitSlop={8}` for smaller elements

### Labels

- All interactive elements should have `accessibilityLabel`
- Form fields have visible labels
- Buttons have clear text labels

### Keyboard

- Use appropriate `keyboardType` for inputs
- Forms should handle keyboard with `keyboardShouldPersistTaps="handled"`
- Modal sheets use `keyboardBehavior="interactive"` (via BottomSheet)

---

## File Structure

```
apps/mobile/
├── App.tsx                    # Root app with providers
├── src/
│   ├── components/
│   │   └── ui.tsx            # All UI components
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── ProductsScreen.tsx (Inventory)
│   │   ├── SalesScreen.tsx
│   │   ├── BillingScreen.tsx
│   │   ├── PartiesScreen.tsx
│   │   └── MoreScreen.tsx
│   ├── lib/
│   │   ├── haptics.ts        # Haptic feedback
│   │   ├── toast.tsx         # Toast notifications
│   │   └── responsive.ts     # Responsive utilities
│   └── theme.tsx             # Theme provider
```

---

## Quick Reference

### Import Common Components

```tsx
import {
  Button,
  Card,
  Field,
  ModalSheet,
  Empty,
  ErrorBox,
  Loading,
  Badge,
  Header,
  Screen,
  colors,
} from '../components/ui';
```

### Import Utilities

```tsx
import {spacing, typography, radii, CARD_MARGIN, rs, rw} from '../lib/responsive';
import {successFeedback, errorFeedback} from '../lib/haptics';
```

### Color Usage Checklist

- [ ] No hardcoded hex colors (except scanner overlay)
- [ ] All text uses `colors.text` or `colors.muted`
- [ ] All backgrounds use `colors.card` or `colors.bg`
- [ ] All borders use `colors.border`
- [ ] Status colors use `colors.success/danger/warning`

### Modal Checklist

- [ ] Forms use `centered` prop
- [ ] Long content uses `scrollable` prop
- [ ] Loading states set `dismissable={false}`
- [ ] Clear title provided
- [ ] Close button or backdrop tap works

### Form Checklist

- [ ] All fields have labels
- [ ] Appropriate keyboardType for inputs
- [ ] Validation before submit
- [ ] Loading state during save
- [ ] Success/error feedback after action
- [ ] Form resets after successful save

---

*Last updated: September 2026*
