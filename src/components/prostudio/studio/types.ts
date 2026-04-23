export type StudioElementType = "background" | "image" | "text" | "shape";

export interface StudioElement {
  id: string;            // value of data-element
  type: StudioElementType;
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface SelectionRect {
  top: number;
  left: number;
  width: number;
  height: number;
}
