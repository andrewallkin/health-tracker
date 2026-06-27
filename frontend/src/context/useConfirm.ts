import { useContext } from "react";

import { ConfirmContext } from "./confirm-context";

export function useConfirm() {
  const confirm = useContext(ConfirmContext);
  if (!confirm) {
    throw new Error("useConfirm must be used within ConfirmDialogProvider");
  }
  return confirm;
}
