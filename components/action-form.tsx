"use client";

import * as React from "react";
import { toast } from "sonner";

import { isRedirectError } from "@/lib/toast-action";

type ActionFormProps = Omit<React.ComponentProps<"form">, "action"> & {
  action: (formData: FormData) => unknown | Promise<unknown>;
  // Omit for actions that redirect() on success — the navigation is the signal.
  successMessage?: string;
  errorMessage?: string;
  onSuccess?: () => void;
};

// Drop-in replacement for <form action={serverAction}> that also surfaces a
// toast on success/failure. Still passes a function to the native `action`
// prop (so useFormStatus/SubmitButton keep working) but calls it manually so
// the result can be observed.
export const ActionForm = React.forwardRef<HTMLFormElement, ActionFormProps>(function ActionForm(
  { action, successMessage, errorMessage, onSuccess, ...props },
  ref,
) {
  return (
    <form
      {...props}
      ref={ref}
      action={async (formData) => {
        try {
          await action(formData);
          if (successMessage) toast.success(successMessage);
          onSuccess?.();
        } catch (error) {
          if (isRedirectError(error)) throw error;
          toast.error(errorMessage ?? "Something went wrong. Please try again.");
        }
      }}
    />
  );
});
