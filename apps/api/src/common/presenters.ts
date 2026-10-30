import { Prisma, type Event, type Farmer, type Field, type Listing } from "@agrisathi/database";

export function jsonValue(value: unknown): Prisma.InputJsonValue {
  return (value ?? {}) as Prisma.InputJsonValue;
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export function farmerOut(farmer: Farmer) {
  return {
    id: farmer.id,
    name: farmer.name,
    district: farmer.district,
    phone: farmer.phone,
    lang: farmer.lang,
    created_at: farmer.createdAt?.toISOString() ?? null,
  };
}

export function fieldOut(field: Field) {
  return {
    id: field.id,
    farmer_id: field.farmerId,
    crop: field.crop,
    variety: field.variety,
    sowing_date: field.sowingDate,
    lat: field.lat,
    lon: field.lon,
    area_ha: field.areaHa,
    location_label: field.locationLabel,
  };
}

export function eventOut(event: Event) {
  return {
    id: event.id,
    field_id: event.fieldId,
    type: event.type,
    payload: asRecord(event.payload),
    created_at: event.createdAt?.toISOString() ?? null,
  };
}

export function listingOut(listing: Listing) {
  return {
    id: listing.id,
    field_id: listing.fieldId,
    crop: listing.crop,
    quantity_ton: listing.quantityTon,
    price_hint_bdt: listing.priceHintBdt,
    district: listing.district,
    notes: listing.notes,
    created_at: listing.createdAt?.toISOString() ?? null,
  };
}

