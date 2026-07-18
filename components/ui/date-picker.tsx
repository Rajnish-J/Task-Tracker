"use client"

import * as React from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

function parseDateValue(value?: string) {
  if (!value) return undefined
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return undefined
  return new Date(year, month - 1, day)
}

function toFieldValue(date?: Date) {
  if (!date) return ""
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

type DatePickerProps = {
  id?: string
  name: string
  defaultValue?: string
  placeholder?: string
  className?: string
  disabled?: boolean
}

function DatePicker({
  id,
  name,
  defaultValue,
  placeholder = "Pick a date",
  className,
  disabled,
}: DatePickerProps) {
  const [date, setDate] = React.useState<Date | undefined>(() =>
    parseDateValue(defaultValue)
  )
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <input type="hidden" name={name} value={toFieldValue(date)} />
      <PopoverTrigger
        render={
          <Button
            id={id}
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-left font-normal",
              !date && "text-muted-foreground",
              className
            )}
          />
        }
      >
        <CalendarIcon className="size-4" />
        {date ? format(date, "PPP") : placeholder}
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          onSelect={(selected) => {
            setDate(selected)
            setOpen(false)
          }}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
