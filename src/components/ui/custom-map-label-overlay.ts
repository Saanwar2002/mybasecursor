// This will be a factory function to create the class
// It expects the fully loaded 'google.maps' object as an argument.

// Forward declare to satisfy TypeScript before google global is ready
// This helps TypeScript understand the types even if 'google' isn't globally defined at parse time.
declare global {
  interface Window {
    google: typeof google;
  }
}

export type LabelType = 'pickup' | 'dropoff' | 'driver' | 'stop' | 'hazard';
export type LabelVariant = 'default' | 'compact';

// Define an interface for the instance methods we expect
export interface ICustomMapLabelOverlay extends google.maps.OverlayView {
  updatePosition(position: google.maps.LatLngLiteral): void;
  updateContent(content: string, type: LabelType, variant?: LabelVariant): void;
  show(): void;
  hide(): void;
}

// Define a type for the constructor we expect our factory to return
export type CustomMapLabelOverlayConstructor = new (
  position: google.maps.LatLngLiteral,
  content: string,
  type: LabelType,
  options?: {
    variant?: LabelVariant;
    icon?: string; // We'll pass SVG string here
  }
) => ICustomMapLabelOverlay;


export function getCustomMapLabelOverlayClass(mapsApiInstance: typeof google.maps): CustomMapLabelOverlayConstructor {
  class CustomMapLabelOverlayInternal extends mapsApiInstance.OverlayView implements ICustomMapLabelOverlay {
    private mapsLatLng: typeof mapsApiInstance.LatLng;
    private positionLatLng: google.maps.LatLng;
    private content: string;
    private type: LabelType;
    private variant: LabelVariant;
    private icon?: string;
    private div: HTMLDivElement | null = null;
    private visible: boolean = true;

    constructor(
        position: google.maps.LatLngLiteral, 
        content: string, 
        type: LabelType, 
        options: { variant?: LabelVariant, icon?: string } = {}
    ) {
      super();
      this.mapsLatLng = mapsApiInstance.LatLng;
      this.positionLatLng = new this.mapsLatLng(position.lat, position.lng);
      this.content = content;
      this.type = type;
      this.variant = options.variant || 'default';
      this.icon = options.icon;
    }

    private _applyStyles() {
      if (!this.div) return;

      // Common styles
      this.div.style.textAlign = 'center';
      this.div.style.whiteSpace = 'pre-line'; // Crucial for \n line breaks
      this.div.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
      this.div.style.zIndex = '101';
      this.div.style.lineHeight = '1.3';
      this.div.style.overflow = 'hidden';
      this.div.style.textOverflow = 'ellipsis';
      this.div.style.transform = 'translateX(-50%) translateY(-100%) translateY(-12px)'; // Adjust vertical offset


      if (this.type === 'hazard') {
        this.div.style.display = 'flex';
        this.div.style.alignItems = 'center';
        this.div.style.gap = '4px';
        this.div.style.padding = '3px 6px';
        this.div.style.borderRadius = '6px';
        this.div.style.fontSize = '10px';
        this.div.style.background = 'rgba(0,0,0,0.7)';
        this.div.style.color = 'white';
        this.div.style.border = '1px solid white';
        this.div.style.fontWeight = 'bold';
      } else if (this.variant === 'compact') {
        this.div.style.padding = '2px 4px';
        this.div.style.borderRadius = '4px';
        this.div.style.fontSize = '9px';
        this.div.style.minWidth = 'auto'; 
        this.div.style.maxWidth = '100px'; 
      } else { // Default styles - more prominent, like the screenshot
        this.div.style.padding = '5px 8px';
        this.div.style.borderRadius = '8px';
        this.div.style.fontSize = '11px'; // Slightly larger font for default
        this.div.style.minWidth = '100px'; // Min width for better shape
        this.div.style.maxWidth = '180px'; // Max width for very long addresses
      }

      // Type-specific styles
      if (this.type === 'pickup') {
        this.div.style.background = 'rgb(22, 163, 74)'; // Green
        this.div.style.border = '1px solid rgba(0, 70, 20, 0.6)';
        this.div.style.color = '#FFFFFF';
        this.div.style.fontWeight = 'bold';
      } else if (this.type === 'dropoff') {
        this.div.style.background = 'rgb(220, 38, 38)'; // Red (matches screenshot)
        this.div.style.border = '1px solid rgba(120, 0, 0, 0.6)';
        this.div.style.color = '#FFFFFF'; // White text (matches screenshot)
        this.div.style.fontWeight = 'bold';
      } else if (this.type === 'stop') {
        this.div.style.background = 'rgb(250, 204, 21)'; // Yellow-ish (Tailwind yellow-400)
        this.div.style.border = '1px solid rgba(100, 80, 0, 0.6)';
        this.div.style.color = '#000000'; // Black text for yellow background
        this.div.style.fontWeight = 'bold';
      } else if (this.type === 'driver') {
        this.div.style.background = 'rgba(0, 0, 0, 0.75)';
        this.div.style.border = '1px solid rgba(255, 255, 255, 0.75)';
        this.div.style.color = '#FFFFFF';
        this.div.style.fontWeight = '600';
        this.div.style.fontSize = this.variant === 'compact' ? '9px' : '11px';
        this.div.style.minWidth = this.variant === 'compact' ? 'auto' : '110px'; 
        this.div.style.maxWidth = this.variant === 'compact' ? '90px' : '130px';
      }
    }

    onAdd() {
      this.div = document.createElement('div');
      this.div.style.position = 'absolute';
      this.div.style.pointerEvents = 'none';

      this._applyStyles();
      
      let innerHTML = '';
      if (this.icon) {
        // The icon should be an SVG string
        innerHTML += this.icon;
      }
      innerHTML += `<span>${this.content}</span>`;
      this.div.innerHTML = innerHTML;

      const panes = this.getPanes();
      if (panes) {
        panes.floatPane.appendChild(this.div);
      }
    }

    draw() {
      const projection = this.getProjection();
      if (!projection || !this.div) {
        return;
      }
      const sw = projection.fromLatLngToDivPixel(this.positionLatLng);
      if (sw) {
        this.div.style.left = `${sw.x}px`;
        this.div.style.top = `${sw.y}px`;
      }
      this.div.style.visibility = this.visible ? 'visible' : 'hidden';
    }

    onRemove() {
      if (this.div && this.div.parentNode) {
        this.div.parentNode.removeChild(this.div);
        this.div = null;
      }
    }

    hide() {
      if (this.div) {
        this.div.style.visibility = 'hidden';
        this.visible = false;
      }
    }

    show() {
      if (this.div) {
        this.div.style.visibility = 'visible';
        this.visible = true;
      }
    }

    updateContent(newContent: string, newType: LabelType, newVariant?: LabelVariant) {
      this.content = newContent;
      this.type = newType;
      if (newVariant) {
        this.variant = newVariant;
      }
      if (this.div) {
        let innerHTML = '';
        if (this.icon) {
            innerHTML += this.icon;
        }
        innerHTML += `<span>${this.content}</span>`;
        this.div.innerHTML = innerHTML;
        this._applyStyles(); 
      }
    }

    updatePosition(newPosition: google.maps.LatLngLiteral) {
      this.positionLatLng = new this.mapsLatLng(newPosition.lat, newPosition.lng);
      this.draw();
    }
  }
  return CustomMapLabelOverlayInternal;
}
