"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DebugDialogClose = React.forwardRef(function DebugDialogClose(props: any, ref) {
  const child = props.children;
  if (Array.isArray(child)) {
    console.error('DialogClose asChild received an array:', child);
  } else if (!React.isValidElement(child)) {
    console.error('DialogClose asChild received a non-element:', child);
  }
  return <DialogPrimitive.Close ref={ref} {...props}>{child}</DialogPrimitive.Close>;
});

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        // Custom styles for BookRidePage confirmation dialog
        // Apply these classes if the DialogContent has a specific data attribute or className passed to it from BookRidePage.
        // For now, we'll make it general, but it can be targeted.
        // Example: if BookRidePage's DialogContent has className="book-ride-confirmation-dialog", then:
        // ".book-ride-confirmation-dialog:sm:max-w-md .book-ride-confirmation-dialog:grid-rows-[auto_minmax(0,1fr)_auto] .book-ride-confirmation-dialog:max-h-[90vh] .book-ride-confirmation-dialog:p-0",
        className
      )}
      {...props}
    >
      {children}
      {/* The default close button below has been removed.
      <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
      */}
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
       // Custom styles for BookRidePage confirmation dialog header
      "[.book-ride-confirmation-dialog_&]:p-6 [.book-ride-confirmation-dialog_&]:pb-4 [.book-ride-confirmation-dialog_&]:border-b",
      className
    )}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      // Custom styles for BookRidePage confirmation dialog footer
      "[.book-ride-confirmation-dialog_&]:p-6 [.book-ride-confirmation-dialog_&]:pt-4 [.book-ride-confirmation-dialog_&]:border-t",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      // Custom for BookRidePage
      "[.book-ride-confirmation-dialog_&]:text-xl [.book-ride-confirmation-dialog_&]:font-headline",
      className
    )}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

// Debug wrapper for asChild components
function debugAsChild(name: string, props: any) {
  const child = props.children;
  if (Array.isArray(child)) {
    console.error(`${name} asChild received an array:`, child);
  } else if (!React.isValidElement(child)) {
    console.error(`${name} asChild received a non-element:`, child);
  }
}

const DebugDialogTrigger = React.forwardRef(function DebugDialogTrigger(props: any, ref) {
  debugAsChild('DialogTrigger', props);
  return <DialogPrimitive.Trigger ref={ref} {...props}>{props.children}</DialogPrimitive.Trigger>;
});

const DebugDialogContent = React.forwardRef(function DebugDialogContent(props: any, ref) {
  debugAsChild('DialogContent', props);
  return <DialogPrimitive.Content ref={ref} {...props}>{props.children}</DialogPrimitive.Content>;
});

const DebugDialogHeader = (props: any) => {
  debugAsChild('DialogHeader', props);
  return <div {...props}>{props.children}</div>;
};

const DebugDialogFooter = (props: any) => {
  debugAsChild('DialogFooter', props);
  return <div {...props}>{props.children}</div>;
};

const DebugDialogTitle = React.forwardRef(function DebugDialogTitle(props: any, ref) {
  debugAsChild('DialogTitle', props);
  return <DialogPrimitive.Title ref={ref} {...props}>{props.children}</DialogPrimitive.Title>;
});

const DebugDialogDescription = React.forwardRef(function DebugDialogDescription(props: any, ref) {
  debugAsChild('DialogDescription', props);
  return <DialogPrimitive.Description ref={ref} {...props}>{props.children}</DialogPrimitive.Description>;
});

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DebugDialogClose as DialogClose,
  DebugDialogTrigger as DialogTrigger,
  DebugDialogContent as DialogContent,
  DebugDialogHeader as DialogHeader,
  DebugDialogFooter as DialogFooter,
  DebugDialogTitle as DialogTitle,
  DebugDialogDescription as DialogDescription,
}
