// apps/web/src/components/intake/StepProjectDetails.tsx
import { CITY_NAMES } from "@tmcc/shared-types";
import { MapPin, Phone, User } from "lucide-react";
import { SelectField, TextField } from "./fields";
import { MODEL_OPTIONS } from "./option-config";
import { OptionCards } from "./OptionCards";
import type { StepProps } from "./types";

export function StepProjectDetails({ values, errors, setField }: StepProps) {
  return (
    <section className="space-y-5">
      <h2 className="text-lg font-bold text-brand-black">
        1. Tell us about your project
      </h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          id="name"
          label="Full Name"
          required
          icon={<User className="size-4" />}
          placeholder="Enter your full name"
          value={values.name}
          error={errors.name}
          onChange={(e) => setField("name", e.target.value)}
        />
        <TextField
          id="contact"
          label="Contact"
          required
          icon={<Phone className="size-4" />}
          placeholder="03XX-XXXXXXX (Phone / WhatsApp)"
          value={values.contact}
          error={errors.contact}
          onChange={(e) => setField("contact", e.target.value)}
        />
        <SelectField
          id="city"
          label="City"
          required
          icon={<MapPin className="size-4" />}
          placeholder="Select a city"
          options={CITY_NAMES.map((c) => ({ value: c, label: c }))}
          value={values.city}
          error={errors.city}
          onChange={(v) => setField("city", v)}
        />
      </div>

      <OptionCards
        legend="Engagement Model"
        required
        options={MODEL_OPTIONS}
        value={values.model}
        error={errors.model}
        onChange={(v) => setField("model", v)}
      />
    </section>
  );
}
