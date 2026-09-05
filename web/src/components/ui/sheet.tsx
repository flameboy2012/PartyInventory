"use client"

import * as React from "react"
import { Drawer as DrawerPrimitive } from "@base-ui/react/drawer"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { XIcon } from "lucide-react"

/**
 * A bottom sheet, built on the drawer primitive so drag-to-dismiss, scroll locking and
 * keyboard avoidance come from the library rather than from this file.
 *
 * The popup bleeds 3rem past the bottom edge so an overscroll never reveals the page behind it;
 * that bleed is what the negative margin and the extra bottom padding are paying for.
 */

const SHEET_BLEED = "3rem"

function Sheet({ ...props }: DrawerPrimitive.Root.Props) {
  return <DrawerPrimitive.Root data-slot="sheet" {...props} />
}

function SheetTrigger({ ...props }: React.ComponentProps<typeof DrawerPrimitive.Trigger>) {
  return <DrawerPrimitive.Trigger data-slot="sheet-trigger" {...props} />
}

function SheetPortal({ ...props }: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="sheet-portal" {...props} />
}

function SheetClose({ ...props }: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="sheet-close" {...props} />
}

/** An invisible edge strip that opens the sheet on a swipe. */
function SheetSwipeArea({ ...props }: DrawerPrimitive.SwipeArea.Props) {
  return <DrawerPrimitive.SwipeArea data-slot="sheet-swipe-area" {...props} />
}

/** Wrap a sheet that holds form fields so the software keyboard doesn't cover them. */
function SheetVirtualKeyboardProvider({
  ...props
}: DrawerPrimitive.VirtualKeyboardProvider.Props) {
  return <DrawerPrimitive.VirtualKeyboardProvider {...props} />
}

function SheetOverlay({ className, ...props }: DrawerPrimitive.Backdrop.Props) {
  return (
    <DrawerPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 min-h-dvh bg-black opacity-[calc(0.34*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:duration-0 data-starting-style:opacity-0 data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] motion-reduce:transition-none supports-[-webkit-touch-callout:none]:absolute",
        className
      )}
      {...props}
    />
  )
}

function SheetContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: DrawerPrimitive.Popup.Props & {
  showCloseButton?: boolean
}) {
  return (
    <SheetPortal>
      <SheetOverlay />
      <DrawerPrimitive.Viewport
        data-slot="sheet-viewport"
        className="fixed inset-0 z-50 flex items-end justify-center"
      >
        <DrawerPrimitive.Popup
          data-slot="sheet-content"
          style={{ "--bleed": SHEET_BLEED } as React.CSSProperties}
          className={cn(
            "relative w-full max-h-[calc(85dvh+var(--bleed))] -mb-(--bleed) touch-auto overflow-y-auto overscroll-contain rounded-t-[20px] bg-popover px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px)+var(--bleed))] text-sm text-popover-foreground shadow-[0_-10px_30px_rgb(0_0_0/0.14)] outline-none [transform:translateY(var(--drawer-swipe-movement-y))] transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-swiping:select-none data-starting-style:[transform:translateY(calc(100%-var(--bleed)+2px))] data-ending-style:[transform:translateY(calc(100%-var(--bleed)+2px))] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] motion-reduce:transition-none",
            className
          )}
          {...props}
        >
          <div
            data-slot="sheet-handle"
            aria-hidden
            className="mx-auto mb-2 h-1 w-9.5 rounded-full bg-border"
          />
          <DrawerPrimitive.Content
            data-slot="sheet-body"
            className="mx-auto w-full max-w-lg"
          >
            {children}
          </DrawerPrimitive.Content>
          {showCloseButton && (
            <DrawerPrimitive.Close
              data-slot="sheet-close"
              render={
                <Button
                  variant="ghost"
                  className="absolute top-2 right-2 size-11 md:size-8"
                  size="icon"
                />
              }
            >
              <XIcon />
              <span className="sr-only">Close</span>
            </DrawerPrimitive.Close>
          )}
        </DrawerPrimitive.Popup>
      </DrawerPrimitive.Viewport>
    </SheetPortal>
  )
}

function SheetHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-header"
      className={cn("flex flex-col gap-1 pr-10", className)}
      {...props}
    />
  )
}

function SheetFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="sheet-footer"
      className={cn(
        "-mx-4 mt-4 flex flex-col-reverse gap-2 border-t bg-muted/50 px-4 pt-4 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function SheetTitle({ className, ...props }: DrawerPrimitive.Title.Props) {
  return (
    <DrawerPrimitive.Title
      data-slot="sheet-title"
      className={cn("font-heading text-base leading-5 font-medium", className)}
      {...props}
    />
  )
}

function SheetDescription({ className, ...props }: DrawerPrimitive.Description.Props) {
  return (
    <DrawerPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-[13.5px] leading-[19px] text-muted-foreground", className)}
      {...props}
    />
  )
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetSwipeArea,
  SheetTitle,
  SheetTrigger,
  SheetVirtualKeyboardProvider,
}
