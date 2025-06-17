import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatAddressForMapLabel(fullAddress: string, type: string): string {
  if (!fullAddress) return `${type}:\nN/A`;
  
  const parts = fullAddress.split(',').map(p => p.trim()).filter(Boolean);
  let line1 = "";
  let line2 = "";
  let line3 = "";

  if (parts.length === 1) {
    line1 = parts[0];
  } else if (parts.length === 2) {
    line1 = parts[0];
    line2 = parts[1];
  } else if (parts.length >= 3) {
    line1 = parts[0]; // Street or POI Name
    line2 = parts[1]; // Locality/Area
    
    // Check if the POI name itself might contain the locality, e.g. "Salendine Nook Shopping Centre, Huddersfield"
    // If parts[0] is long and parts[1] is a common city name, parts[1] might be better on its own line.
    // This is a heuristic.
    if (parts[0].length > 25 && parts[1].match(/^(Huddersfield|Leeds|Manchester|London|Birmingham|Liverpool|Sheffield|Bristol|Wakefield|Halifax|Bradford|Oldham|Rochdale|Barnsley|Dewsbury|Keighley|Batley|Brighouse|Todmorden|Elland|Sowerby Bridge|Mirfield|Heckmondwike|Holmfirth|Meltham|Denby Dale|Kirkburton|Skelmanthorpe|Clayton West|Golcar|Linthwaite|Marsden|Slaithwaite)$/i)) {
        // If part[0] is long and part[1] is a major town/city, keep them separate
        line3 = parts.slice(2).join(', '); // Rest becomes line3 (postcode usually)
    } else {
        // Otherwise, combine parts[1] and potentially parts[2] if it's not a postcode like structure
        if (parts.length > 2 && !parts[2].match(/\b[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}\b/i) && parts[2].length < 15) {
            line2 += `, ${parts[2]}`;
            line3 = parts.slice(3).join(', ');
        } else {
            line3 = parts.slice(2).join(', ');
        }
    }
  }
  
  // Specific heuristic for "Shopping Centre" type names to break them if too long
  if (line1.includes("Shopping Centre") && line1.length > 25) {
    const scIndex = line1.lastIndexOf("Shopping Centre");
    if (scIndex > 0) {
        const potentialLine1 = line1.substring(0, scIndex).trim();
        const potentialLine1Cont = line1.substring(scIndex).trim();
        if (potentialLine1.length > 5) { // Avoid tiny first lines
            line1 = `${potentialLine1}\n${potentialLine1Cont}`;
        }
    }
  } else if (line1.length > 30) { // Generic very long line1 break attempt
    let breakPoint = line1.lastIndexOf(' ', 25); // Find last space before char 25
    if (breakPoint === -1 && line1.length > 25) breakPoint = 25; // Force break if no space
    if (breakPoint > 0 && line1.length - breakPoint > 5) { // Ensure second part is not too small
        line1 = `${line1.substring(0, breakPoint)}\n${line1.substring(breakPoint + 1)}`;
    }
  }


  let output = `${type}:`;
  if (line1) output += `\n${line1}`;
  if (line2 && line2.trim()) output += `\n${line2.trim()}`;
  if (line3 && line3.trim()) output += `\n${line3.trim()}`;
  
  return output.replace(/\n\n+/g, '\n'); // Remove potential double newlines
}
