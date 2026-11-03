import type * as React from 'react';

/*
 * JSX typings for the UI5 Web Components (v2) rendered by AegisShield.
 *
 * React 19 sets a prop as a DOM *property* when the custom element defines it, so the
 * camelCase names below map 1:1 to the UI5 component properties. Attribute spelling
 * (e.g. `header-text`) is also accepted by TypeScript because hyphenated JSX attributes
 * are not type-checked.
 *
 * Events: React's own `onClick`, `onChange`, `onInput`, `onKeyDown`, `onFocus` … work for
 * UI5 events that bubble (button click, input/select/textarea change and input).
 * Every other UI5 event is listened to with React 19's native custom-element syntax
 * `on<event-name>` (lower-case, kebab-case), which React wires with addEventListener:
 *   <ui5-segmented-button onselection-change={…}>, <ui5-dialog onclose={…}>.
 * Each element below declares the events it fires in that form.
 */

type UI5Event<Detail = unknown, Target extends HTMLElement = HTMLElement> = CustomEvent<Detail> & {
  target: Target;
  currentTarget: Target;
};
type UI5Handler<Detail = unknown> = (event: UI5Event<Detail>) => void;

type ValueState = 'None' | 'Positive' | 'Critical' | 'Negative' | 'Information';
type ButtonDesign = 'Default' | 'Positive' | 'Negative' | 'Transparent' | 'Emphasized' | 'Attention';
type TitleLevel = 'H1' | 'H2' | 'H3' | 'H4' | 'H5' | 'H6';
type WrappingType = 'None' | 'Normal';
type TagDesign = 'Set1' | 'Set2' | 'Neutral' | 'Information' | 'Positive' | 'Negative' | 'Critical';

/** Common host props: every standard HTML attribute, `ref`, `key`, `slot`, children. */
type HostProps<E extends HTMLElement = HTMLElement> = Omit<React.DetailedHTMLProps<React.HTMLAttributes<E>, E>, 'unselectable'> & {
  unselectable?: boolean | 'on' | 'off';
  slot?: string;
  children?: React.ReactNode;
};

interface AccessibleProps {
  accessibleName?: string;
  accessibleNameRef?: string;
  accessibleDescription?: string;
  accessibleDescriptionRef?: string;
}

interface FormFieldProps extends AccessibleProps {
  value?: string;
  name?: string;
  disabled?: boolean;
  readonly?: boolean;
  required?: boolean;
  placeholder?: string;
  valueState?: ValueState;
}

interface PopupEvents {
  'onbefore-open'?: UI5Handler;
  onopen?: UI5Handler;
  'onbefore-close'?: UI5Handler<{ escPressed: boolean }>;
  onclose?: UI5Handler;
}

interface PopupProps extends AccessibleProps, PopupEvents {
  open?: boolean;
  initialFocus?: string;
  preventFocusRestore?: boolean;
  preventInitialFocus?: boolean;
  accessibleRole?: 'None' | 'Dialog' | 'AlertDialog';
}
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      // ---------------------------------------------------------------- actions
      'ui5-button': HostProps & AccessibleProps & {
        design?: ButtonDesign;
        disabled?: boolean;
        icon?: string;
        endIcon?: string;
        submit?: boolean;
        type?: 'Button' | 'Submit' | 'Reset';
        tooltip?: string;
        loading?: boolean;
        accessibilityAttributes?: { expanded?: boolean | 'true' | 'false'; hasPopup?: string; controls?: string };
      };
      'ui5-segmented-button': HostProps & AccessibleProps & {
        selectionMode?: 'Single' | 'Multiple';
        'onselection-change'?: UI5Handler<{ selectedItems: HTMLElement[] }>;
      };
      'ui5-segmented-button-item': HostProps & AccessibleProps & {
        selected?: boolean;
        disabled?: boolean;
        icon?: string;
        tooltip?: string;
      };

      // ---------------------------------------------------------- display / text
      'ui5-title': HostProps & {
        level?: TitleLevel;
        size?: TitleLevel;
        wrappingType?: WrappingType;
      };
      'ui5-label': HostProps & {
        for?: string;
        showColon?: boolean;
        required?: boolean;
        wrappingType?: WrappingType;
      };
      'ui5-tag': HostProps & {
        design?: TagDesign;
        colorScheme?: string;
        hideStateIcon?: boolean;
        interactive?: boolean;
        wrappingType?: WrappingType;
        size?: 'S' | 'L';
      };
      'ui5-checkbox': HostProps & AccessibleProps & {
        text?: string;
        checked?: boolean;
        disabled?: boolean;
        name?: string;
        value?: string;
        wrappingType?: WrappingType;
      };
      'ui5-badge': HostProps & AccessibleProps & {
        colorScheme?: string;
        'color-scheme'?: string;
        interactive?: boolean;
      };
      'ui5-icon': HostProps & {
        name?: string;
        design?: 'Contrast' | 'Critical' | 'Default' | 'Information' | 'Negative' | 'Neutral' | 'NonInteractive' | 'Positive';
        mode?: 'Image' | 'Decorative' | 'Interactive';
        accessibleName?: string;
        showTooltip?: boolean;
      };
      'ui5-avatar': HostProps & AccessibleProps & {
        initials?: string;
        icon?: string;
        size?: 'XS' | 'S' | 'M' | 'L' | 'XL';
        shape?: 'Circle' | 'Square';
        colorScheme?: string;
        interactive?: boolean;
        disabled?: boolean;
        fallbackIcon?: string;
      };

      // ------------------------------------------------------------- containers
      'ui5-card': HostProps & AccessibleProps & {
        loading?: boolean;
        loadingDelay?: number;
      };
      'ui5-card-header': HostProps & {
        titleText?: string;
        subtitleText?: string;
        status?: string;
        additionalText?: string;
        interactive?: boolean;
        onclick?: UI5Handler;
      };
      'ui5-bar': HostProps & AccessibleProps & {
        design?: 'Header' | 'Subheader' | 'Footer' | 'FloatingFooter';
      };

      // ------------------------------------------------------------------- forms
      'ui5-input': HostProps & FormFieldProps & {
        type?: 'Text' | 'Email' | 'Number' | 'Password' | 'Tel' | 'URL' | 'Search';
        maxlength?: number;
        showClearIcon?: boolean;
        showSuggestions?: boolean;
        noTypeahead?: boolean;
        filter?: 'StartsWithPerTerm' | 'StartsWith' | 'Contains' | 'None';
        open?: boolean;
        onselect?: UI5Handler;
        'onselection-change'?: UI5Handler<{ item: HTMLElement | null }>;
        onopen?: UI5Handler;
        onclose?: UI5Handler;
      };
      'ui5-suggestion-item': HostProps & {
        text?: string;
        additionalText?: string;
      };
      'ui5-textarea': HostProps & FormFieldProps & {
        rows?: number;
        maxlength?: number;
        growing?: boolean;
        growingMaxRows?: number;
        showExceededText?: boolean;
      };
      'ui5-select': HostProps & FormFieldProps & {
        'onlive-change'?: UI5Handler<{ selectedOption: HTMLElement }>;
        onopen?: UI5Handler;
        onclose?: UI5Handler;
      };
      'ui5-option': HostProps & {
        value?: string;
        selected?: boolean;
        icon?: string;
        additionalText?: string;
        tooltip?: string;
      };
      'ui5-date-picker': HostProps & FormFieldProps & {
        formatPattern?: string;
        displayFormat?: string;
        valueFormat?: string;
        minDate?: string;
        maxDate?: string;
        hideWeekNumbers?: boolean;
        open?: boolean;
        'onvalue-state-change'?: UI5Handler<{ valueState: ValueState; valid: boolean }>;
        onopen?: UI5Handler;
        onclose?: UI5Handler;
      };

      // ---------------------------------------------------------------- overlays
      'ui5-dialog': HostProps & PopupProps & {
        headerText?: string;
        stretch?: boolean;
        draggable?: boolean;
        resizable?: boolean;
        state?: ValueState;
      };
      'ui5-popover': HostProps & PopupProps & {
        headerText?: string;
        opener?: string | HTMLElement;
        placement?: 'Start' | 'End' | 'Top' | 'Bottom';
        horizontalAlign?: 'Center' | 'Start' | 'End' | 'Stretch';
        verticalAlign?: 'Center' | 'Top' | 'Bottom' | 'Stretch';
        modal?: boolean;
        hideArrow?: boolean;
        allowTargetOverlap?: boolean;
      };
      'ui5-toast': HostProps & {
        open?: boolean;
        duration?: number;
        placement?: 'TopStart' | 'TopCenter' | 'TopEnd' | 'MiddleStart' | 'MiddleCenter' | 'MiddleEnd' | 'BottomStart' | 'BottomCenter' | 'BottomEnd';
        onclose?: UI5Handler;
      };

      // ------------------------------------------------------------------- table
      'ui5-table': HostProps & AccessibleProps & {
        noDataText?: string;
        overflowMode?: 'Scroll' | 'Popin';
        loading?: boolean;
        loadingDelay?: number;
        rowActionCount?: number;
        'onrow-click'?: UI5Handler<{ row: HTMLElement }>;
      };
      'ui5-table-header-row': HostProps & { sticky?: boolean };
      'ui5-table-header-cell': HostProps & {
        width?: string;
        minWidth?: string;
        importance?: number;
        popinText?: string;
        popinHidden?: boolean;
        horizontalAlign?: 'Left' | 'Start' | 'Right' | 'End' | 'Center';
        sortIndicator?: 'None' | 'Ascending' | 'Descending';
      };
      'ui5-table-row': HostProps & {
        rowKey?: string;
        position?: number;
        interactive?: boolean;
        navigated?: boolean;
        movable?: boolean;
      };
      'ui5-table-cell': HostProps & {
        horizontalAlign?: 'Left' | 'Start' | 'Right' | 'End' | 'Center';
      };

      // ------------------------------------------------------ shell / navigation
      'ui5-shellbar': HostProps & AccessibleProps & {
        primaryTitle?: string;
        secondaryTitle?: string;
        notificationsCount?: string;
        showNotifications?: boolean;
        showProductSwitch?: boolean;
        showSearchField?: boolean;
        hideSearchButton?: boolean;
        disableSearchCollapse?: boolean;
        accessibilityAttributes?: Record<string, Record<string, string | boolean>>;
        'onlogo-click'?: UI5Handler<{ targetRef: HTMLElement }>;
        'onprofile-click'?: UI5Handler<{ targetRef: HTMLElement }>;
        'onnotifications-click'?: UI5Handler<{ targetRef: HTMLElement }>;
        'onproduct-switch-click'?: UI5Handler<{ targetRef: HTMLElement }>;
        'onmenu-item-click'?: UI5Handler<{ item: HTMLElement }>;
        'onsearch-button-click'?: UI5Handler<{ targetRef: HTMLElement; searchFieldVisible: boolean }>;
        'onsearch-field-toggle'?: UI5Handler<{ expanded: boolean }>;
        'onsearch-field-clear'?: UI5Handler<{ targetRef: HTMLElement }>;
      };
      'ui5-shellbar-item': HostProps & {
        icon?: string;
        text?: string;
        count?: string;
        stableDomRef?: string;
        accessibilityAttributes?: { expanded?: boolean | 'true' | 'false'; hasPopup?: string; controls?: string };
        onclick?: UI5Handler<{ targetRef: HTMLElement }>;
      };
      'ui5-navigation-layout': HostProps & {
        mode?: 'Auto' | 'Collapsed' | 'Expanded';
      };
      'ui5-side-navigation': HostProps & {
        collapsed?: boolean;
        accessibleName?: string;
        'onselection-change'?: UI5Handler<{ item: HTMLElement }>;
        'onitem-click'?: UI5Handler<{ item: HTMLElement }>;
      };
      'ui5-side-navigation-item': HostProps & AccessibleProps & {
        text?: string;
        icon?: string;
        selected?: boolean;
        expanded?: boolean;
        disabled?: boolean;
        unselectable?: boolean | 'on' | 'off';
        href?: string;
        target?: string;
        tooltip?: string;
        design?: 'Default' | 'Action';
        onclick?: UI5Handler<{ altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean }>;
      };
      'ui5-side-navigation-sub-item': HostProps & {
        text?: string;
        icon?: string;
        selected?: boolean;
        disabled?: boolean;
        unselectable?: boolean | 'on' | 'off';
        href?: string;
        target?: string;
        tooltip?: string;
        design?: 'Default' | 'Action';
        onclick?: UI5Handler;
      };
      'ui5-side-navigation-group': HostProps & {
        text?: string;
        expanded?: boolean;
        disabled?: boolean;
      };
      'ui5-flexible-column-layout': HostProps & {
        layout?: 'OneColumn' | 'TwoColumnsStartExpanded' | 'TwoColumnsMidExpanded' | 'ThreeColumnsMidExpanded' | 'ThreeColumnsEndExpanded' | 'ThreeColumnsStartExpandedEndHidden' | 'ThreeColumnsMidExpandedEndHidden' | 'ThreeColumnsStartHiddenMidExpanded' | 'ThreeColumnsStartHiddenEndExpanded' | 'MidColumnFullScreen' | 'EndColumnFullScreen';
        disableResizing?: boolean;
        accessibilityAttributes?: Record<string, Record<string, string>>;
        'onlayout-change'?: UI5Handler<{ layout: string; columnLayout: string[]; startColumnVisible: boolean; midColumnVisible: boolean; endColumnVisible: boolean }>;
      };

      // ---------------------------------------------------------------- process
      'ui5-timeline': HostProps & AccessibleProps & {
        layout?: 'Vertical' | 'Horizontal';
        growing?: 'Button' | 'Scroll' | 'None';
        loading?: boolean;
      };
      'ui5-timeline-item': HostProps & {
        titleText?: string;
        subtitleText?: string;
        name?: string;
        nameClickable?: boolean;
        icon?: string;
        state?: ValueState;
        'onname-click'?: UI5Handler;
      };
      'ui5-wizard': HostProps & {
        contentLayout?: 'MultipleSteps' | 'SingleStep';
        'onstep-change'?: UI5Handler<{ step: HTMLElement; previousStep: HTMLElement; withScroll: boolean }>;
      };
      'ui5-wizard-step': HostProps & AccessibleProps & {
        titleText?: string;
        subtitleText?: string;
        icon?: string;
        selected?: boolean;
        disabled?: boolean;
        branching?: boolean;
        status?: string;
      };
    }
  }
}
