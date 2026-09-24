export type WidgetId = string;
export interface WidgetDescriptor { id: WidgetId; visible: boolean; label: string; }
export type Widget = WidgetDescriptor;

const DEFAULT_WIDGETS: WidgetDescriptor[] = [];

export function useWidgetLayout(defaults: WidgetDescriptor[] = DEFAULT_WIDGETS) {
  return {
    widgets: defaults,
    setWidgets: (_: WidgetDescriptor[]) => {},
    setOrder: (_items: WidgetDescriptor[]) => {},
  };
}
