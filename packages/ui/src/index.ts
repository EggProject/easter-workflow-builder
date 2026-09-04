// A csomag publikus felülete: kizárólag nevesített újraexport, `export *`
// nélkül (SPEC-002 6.6). Ami itt nem szerepel, az kívülről nem használható.
// A barrel a coverage kizárási listáján van, ezért futásidejű elágazást nem
// tartalmazhat.

// Segédfüggvények, amiket a komponensek is használnak.
export { joinAriaTokenList } from './aria-token-list/join-aria-token-list.ts';
export { joinClassNames } from './class-name-list/join-class-names.ts';

// Márkajelzés (topnav logó).
export { logoMarkUrl } from './brand-mark/logo-mark-url.ts';

// Elrendezés és téma.
export { AppShellFrame, type AppShellFrameProperties } from './topnav-shell/AppShellFrame.tsx';
export { isThemeMode, THEME_MODE_STORAGE_KEY, THEME_MODE_VALUES, type ThemeMode } from './theme-mode/theme-mode.ts';
export { ThemeModeToggle } from './theme-mode/ThemeModeToggle.tsx';
export { useThemeMode, type UseThemeModeResult } from './theme-mode/use-theme-mode.ts';

// Komponensek.
export { Badge, type BadgeProperties, type BadgeVariant } from './badge/Badge.tsx';
export { Button, type ButtonProperties, type ButtonSize, type ButtonVariant } from './button/Button.tsx';
export { Card, type CardProperties } from './card/Card.tsx';
export {
  DataTable,
  type DataTableAlign,
  type DataTableColumn,
  type DataTableProperties,
} from './data-table/DataTable.tsx';
export { Checkbox, type CheckboxProperties } from './form-control/Checkbox.tsx';
export { ProgressBar, type ProgressBarProperties, type ProgressBarSize } from './loading-indicator/ProgressBar.tsx';
export { Menu, type MenuAlign, type MenuProperties, type MenuTriggerProperties } from './menu/Menu.tsx';
export { MenuItem, type MenuItemProperties } from './menu/MenuItem.tsx';
export { Modal, type ModalIconVariant, type ModalProperties, type ModalSize } from './modal/Modal.tsx';
export {
  SelectField,
  type SelectFieldOption,
  type SelectFieldProperties,
  type SelectFieldSize,
} from './select-field/SelectField.tsx';
export { Skeleton, type SkeletonProperties, type SkeletonShape } from './skeleton/Skeleton.tsx';
export { Tabs, type TabItem, type TabsProperties } from './tab/Tabs.tsx';
export { TextField, type TextFieldProperties } from './text-field/TextField.tsx';
export { Toast, type ToastAction, type ToastProperties, type ToastVariant } from './toast/Toast.tsx';
export { ToastViewport, type ToastViewportProperties, type ToastViewportPosition } from './toast/ToastViewport.tsx';
export {
  useToasts,
  type PushToastInput,
  type ToastRecord,
  type UseToastsOptions,
  type UseToastsResult,
} from './toast/use-toasts.ts';

// Idegen csomagból jövő típus, ami a csomag publikus szignatúrájában
// megjelenik (SPEC-002 6.6): a `DataTable` sor típusának megszorítása a
// táblamotor `RowData` típusa. Átnevezve exportáljuk, hogy a `ui` barrel
// felülete ne vigyen általános nevet.
export type { RowData as DataTableRowData } from '@tanstack/react-table';
