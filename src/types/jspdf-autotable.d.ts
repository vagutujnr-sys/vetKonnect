declare module "jspdf-autotable" {
  import type { jsPDF } from "jspdf";

  export interface UserOptions {
    startY?: number;
    head?: string[][];
    body?: string[][];
    styles?: { fontSize?: number };
  }

  export default function autoTable(doc: jsPDF, options: UserOptions): void;
}
