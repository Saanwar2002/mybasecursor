
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
    
    if (parts[0].length > 25 && parts[1].match(/^(Huddersfield|Leeds|Manchester|London|Birmingham|Liverpool|Sheffield|Bristol|Wakefield|Halifax|Bradford|Oldham|Rochdale|Barnsley|Dewsbury|Keighley|Batley|Brighouse|Todmorden|Elland|Sowerby Bridge|Mirfield|Heckmondwike|Holmfirth|Meltham|Denby Dale|Kirkburton|Skelmanthorpe|Clayton West|Golcar|Linthwaite|Marsden|Slaithwaite)$/i)) {
        line3 = parts.slice(2).join(', '); 
    } else {
        if (parts.length > 2 && !parts[2].match(/\b[A-Z]{1,2}[0-9][A-Z0-9]?\s*[0-9][A-Z]{2}\b/i) && parts[2].length < 15) {
            line2 += `, ${parts[2]}`;
            line3 = parts.slice(3).join(', ');
        } else {
            line3 = parts.slice(2).join(', ');
        }
    }
  }
  
  if (line1.includes("Shopping Centre") && line1.length > 25) {
    const scIndex = line1.lastIndexOf("Shopping Centre");
    if (scIndex > 0) {
        const potentialLine1 = line1.substring(0, scIndex).trim();
        const potentialLine1Cont = line1.substring(scIndex).trim();
        if (potentialLine1.length > 5) { 
            line1 = `${potentialLine1}\n${potentialLine1Cont}`;
        }
    }
  } else if (line1.length > 30) { 
    let breakPoint = line1.lastIndexOf(' ', 25); 
    if (breakPoint === -1 && line1.length > 25) breakPoint = 25; 
    if (breakPoint > 0 && line1.length - breakPoint > 5) { 
        line1 = `${line1.substring(0, breakPoint)}\n${line1.substring(breakPoint + 1)}`;
    }
  }

  let output = `${type}:`;
  if (line1) output += `\n${line1}`;
  if (line2 && line2.trim()) output += `\n${line2.trim()}`;
  if (line3 && line3.trim()) output += `\n${line3.trim()}`;
  
  return output.replace(/\n\n+/g, '\n'); 
}

export function formatAddressForDisplay(fullAddress: string): { line1: string; line2?: string; line3?: string } {
  if (!fullAddress) return { line1: "N/A" };
  
  const parts = fullAddress.split(',').map(p => p.trim()).filter(Boolean);
  let line1 = parts[0] || "Location Detail";
  let line2: string | undefined = undefined;
  let line3: string | undefined = undefined;

  if (parts.length > 1) line2 = parts[1];
  if (parts.length > 2) {
    // Attempt to consolidate postcode or short final parts into line2 if it makes sense
    if (parts.length === 3 && parts[2].length < 10) { // Likely a postcode or short town
        line2 = line2 ? `${line2}, ${parts[2]}` : parts[2];
    } else if (parts.length > 2) {
        line3 = parts.slice(2).join(', ');
    }
  }
  
  // Break very long line1
  if (line1.length > 30) {
    let breakPoint = line1.lastIndexOf(' ', 28);
    if (breakPoint === -1 && line1.length > 28) breakPoint = 28; // Force break if no space found earlier
    if (breakPoint > 0 && line1.length - breakPoint > 5) { // Ensure second part is not too small
      const tempLine1 = line1.substring(0, breakPoint);
      const restOfLine1 = line1.substring(breakPoint + 1);
      line1 = tempLine1;
      // Prepend restOfLine1 to existing line2 or set as line2 if line2 is empty
      line2 = line2 ? `${restOfLine1}, ${line2}` : restOfLine1;
    }
  }

  return { line1, line2, line3 };
}
