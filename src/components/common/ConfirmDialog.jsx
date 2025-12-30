import React from "react";
import Modal from "./Modal";
import Button from "./Button";

export default function ConfirmDialog({ open, title = "تایید", message, onCancel, onConfirm }) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <div className="flex gap-2 justify-start">
          <Button variant="secondary" onClick={onCancel}>انصراف</Button>
          <Button variant="danger" onClick={onConfirm}>تایید</Button>
        </div>
      }
    >
      <div className="text-sm text-zinc-700">{message}</div>
    </Modal>
  );
}
