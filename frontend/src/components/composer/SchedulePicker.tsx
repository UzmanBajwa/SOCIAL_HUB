import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TIMEZONES } from "@/lib/timezone";
import { cn } from "@/lib/utils";

interface SchedulePickerProps {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  timezone: string;
  minDate: string;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onTimezoneChange: (value: string) => void;
  disabled?: boolean;
}

export function SchedulePicker({
  date,
  time,
  timezone,
  minDate,
  onDateChange,
  onTimeChange,
  onTimezoneChange,
  disabled,
}: SchedulePickerProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label htmlFor="schedule-date">Date</Label>
        <Input
          id="schedule-date"
          type="date"
          value={date}
          min={minDate}
          onChange={(e) => onDateChange(e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="schedule-time">Time</Label>
        <Input
          id="schedule-time"
          type="time"
          value={time}
          onChange={(e) => onTimeChange(e.target.value)}
          disabled={disabled}
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="schedule-timezone">Timezone</Label>
        <select
          id="schedule-timezone"
          value={timezone}
          onChange={(e) => onTimezoneChange(e.target.value)}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          )}
        >
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
