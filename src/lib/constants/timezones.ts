// Curated timezone list for the business onboarding form. Not the full IANA
// database (400+ entries nobody scrolls through) -- the zones relevant to
// AiFekr's actual markets (Iran/region, Europe, North America) plus UTC.
export interface TimezoneOption {
  value: string;
  label: string;
}

export const TIMEZONES: TimezoneOption[] = [
  { value: "Asia/Tehran", label: "Tehran (GMT+3:30)" },
  { value: "Asia/Kabul", label: "Kabul (GMT+4:30)" },
  { value: "Asia/Dushanbe", label: "Dushanbe (GMT+5)" },
  { value: "Europe/Istanbul", label: "Istanbul (GMT+3)" },
  { value: "Asia/Dubai", label: "Dubai (GMT+4)" },
  { value: "Asia/Riyadh", label: "Riyadh (GMT+3)" },
  { value: "Asia/Baghdad", label: "Baghdad (GMT+3)" },
  { value: "Europe/Berlin", label: "Berlin (GMT+1)" },
  { value: "Europe/Vienna", label: "Vienna (GMT+1)" },
  { value: "Europe/Zurich", label: "Zurich (GMT+1)" },
  { value: "Europe/London", label: "London (GMT+0)" },
  { value: "Europe/Paris", label: "Paris (GMT+1)" },
  { value: "Europe/Amsterdam", label: "Amsterdam (GMT+1)" },
  { value: "Europe/Stockholm", label: "Stockholm (GMT+1)" },
  { value: "Europe/Rome", label: "Rome (GMT+1)" },
  { value: "Europe/Madrid", label: "Madrid (GMT+1)" },
  { value: "America/New_York", label: "New York (GMT-5)" },
  { value: "America/Chicago", label: "Chicago (GMT-6)" },
  { value: "America/Los_Angeles", label: "Los Angeles (GMT-8)" },
  { value: "America/Toronto", label: "Toronto (GMT-5)" },
  { value: "Australia/Sydney", label: "Sydney (GMT+11)" },
  { value: "UTC", label: "UTC (GMT+0)" },
];
