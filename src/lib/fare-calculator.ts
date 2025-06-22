import { Client, LatLng } from "@googlemaps/google-maps-services-js";

// --- Type Definitions ---
export interface Coords {
    lat: number;
    lng: number;
}

export type VehicleType = 
  | "car" | "estate" | "minibus_6" | "minibus_8"
  | "pet_friendly_car" | "disable_wheelchair_access"
  | "minibus_6_pet_friendly" | "minibus_8_pet_friendly";

export interface FareCalculationParams {
  pickupCoords: Coords;
  dropoffCoords: Coords;
  stops?: Coords[];
  vehicleType: VehicleType;
  passengers: number;
  isWaitAndReturn?: boolean;
  estimatedWaitTimeMinutes?: number;
  isPriorityPickup?: boolean;
  priorityFeeAmount?: number;
  isSurgeApplied?: boolean; // This can be determined by the server
}

// --- Configuration Constants ---
const BASE_FARE = 0.00;
const PER_MILE_RATE = 1.00;
const FIRST_MILE_SURCHARGE = 1.99;
const PER_MINUTE_RATE = 0.10;
const BOOKING_FEE = 0.75;
const MINIMUM_FARE = 4.00;
const SURGE_MULTIPLIER_VALUE = 1.5;
const PER_STOP_SURCHARGE = 0.50;
const WAIT_AND_RETURN_SURCHARGE_PERCENTAGE = 0.70;
const FREE_WAITING_TIME_MINUTES_AT_DESTINATION = 10;
const WAITING_CHARGE_PER_MINUTE_AT_DESTINATION = 0.20;
const PET_FRIENDLY_SURCHARGE = 2.00;

const METER_TO_MILE_CONVERSION = 1609.34;
const googleMapsClient = new Client({});

// --- Main Calculation Function ---
export async function calculateFare(
  params: FareCalculationParams
): Promise<{ fareEstimate: number, distance: number, duration: number, surgeMultiplier: number }> {
    
    const { 
        pickupCoords, dropoffCoords, stops = [], vehicleType, passengers,
        isWaitAndReturn = false, estimatedWaitTimeMinutes = 0,
        isPriorityPickup = false, priorityFeeAmount = 0, isSurgeApplied = false
    } = params;

    const allWaypoints = [pickupCoords, ...stops, dropoffCoords];

    try {
        const routeDetails = await getRouteDetails(allWaypoints);
        const { totalDistanceMiles, totalDurationMinutes } = routeDetails;

        let oneWayJourneyFare = 0;
        if (totalDistanceMiles > 0) {
            const timeFareOneWay = totalDurationMinutes * PER_MINUTE_RATE;
            const distanceBasedFareOneWay = (totalDistanceMiles * PER_MILE_RATE) + FIRST_MILE_SURCHARGE;
            const stopSurchargeAmount = stops.length * PER_STOP_SURCHARGE;
            oneWayJourneyFare = BASE_FARE + timeFareOneWay + distanceBasedFareOneWay + stopSurchargeAmount + BOOKING_FEE;
        }

        let vehicleMultiplier = 1.0;
        if (vehicleType === "estate") vehicleMultiplier = 1.2;
        else if (vehicleType === "minibus_6" || vehicleType === "minibus_6_pet_friendly") vehicleMultiplier = 1.5;
        else if (vehicleType === "minibus_8" || vehicleType === "minibus_8_pet_friendly") vehicleMultiplier = 1.6;
        else if (vehicleType === "disable_wheelchair_access") vehicleMultiplier = 2.0;
        
        const passengerAdjustment = 1 + (Math.max(0, passengers - 1)) * 0.1;
        
        let baseAdjustedFare = oneWayJourneyFare * vehicleMultiplier * passengerAdjustment;

        if (vehicleType.includes("pet_friendly")) {
            baseAdjustedFare += PET_FRIENDLY_SURCHARGE;
        }
        
        baseAdjustedFare = Math.max(baseAdjustedFare, MINIMUM_FARE);

        let finalCalculatedFare = baseAdjustedFare;
        if (isWaitAndReturn) {
            finalCalculatedFare *= (1 + WAIT_AND_RETURN_SURCHARGE_PERCENTAGE);
            const chargeableWaitTime = Math.max(0, estimatedWaitTimeMinutes - FREE_WAITING_TIME_MINUTES_AT_DESTINATION);
            finalCalculatedFare += chargeableWaitTime * WAITING_CHARGE_PER_MINUTE_AT_DESTINATION;
        }

        if (isPriorityPickup && priorityFeeAmount > 0) {
            finalCalculatedFare += priorityFeeAmount;
        }

        const surgeMultiplierToApply = isSurgeApplied ? SURGE_MULTIPLIER_VALUE : 1;
        const fareWithSurge = finalCalculatedFare * surgeMultiplierToApply;

        return {
            fareEstimate: parseFloat(fareWithSurge.toFixed(2)),
            distance: routeDetails.totalDistanceMeters,
            duration: routeDetails.totalDurationSeconds,
            surgeMultiplier: surgeMultiplierToApply
        };

    } catch (error) {
        console.error("Fare calculation failed:", error);
        throw new Error("Failed to calculate fare. Please check locations.");
    }
}

async function getRouteDetails(waypoints: Coords[]) {
    if (waypoints.length < 2) {
        return { totalDistanceMeters: 0, totalDurationSeconds: 0, totalDistanceMiles: 0, totalDurationMinutes: 0 };
    }

    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const intermediateWaypoints = waypoints.slice(1, -1);

    const directionsResponse = await googleMapsClient.directions({
        params: {
            origin,
            destination,
            waypoints: intermediateWaypoints,
            key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
        },
    });

    if (directionsResponse.data.routes.length === 0) {
        throw new Error("Could not find a route for the given locations.");
    }
    
    let totalDistanceMeters = 0;
    let totalDurationSeconds = 0;

    directionsResponse.data.routes[0].legs.forEach(leg => {
        totalDistanceMeters += leg.distance.value;
        totalDurationSeconds += leg.duration.value;
    });

    return {
        totalDistanceMeters,
        totalDurationSeconds,
        totalDistanceMiles: totalDistanceMeters / METER_TO_MILE_CONVERSION,
        totalDurationMinutes: totalDurationSeconds / 60,
    };
}

// --- Haversine Distance Fallback ---
function getHaversineDistance(point1: Coords, point2: Coords): number {
    const R = 3958.8; // Radius of the Earth in miles
    const rlat1 = deg2rad(point1.lat);
    const rlat2 = deg2rad(point2.lat);
    const difflat = rlat2 - rlat1;
    const difflon = deg2rad(point2.lng - point1.lng);
    const d = 2 * R * Math.asin(Math.sqrt(Math.sin(difflat / 2) * Math.sin(difflat / 2) + Math.cos(rlat1) * Math.cos(rlat2) * Math.sin(difflon / 2) * Math.sin(difflon / 2)));
    return d;
}

function deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
} 