
// This will be a factory function to create the class
// It expects the fully loaded 'google.maps' object as an argument.

// Forward declare to satisfy TypeScript before google global is ready
// This helps TypeScript understand the types even if 'google' isn't globally defined at parse time.
declare global {
  interface Window {
    google: typeof google;
  }
}

export type LabelType = 'pickup' | 'dropoff' | 'driver' | 'stop'; // Added 'stop'

// Define an interface for the instance methods we expect
export interface ICustomMapLabelOverlay extends google.maps.OverlayView {
  updatePosition(position: google.maps.LatLngLiteral): void;
  updateContent(content: string, type: LabelType): void;
  show(): void;
  hide(): void;
}

// Define a type for the constructor we expect our factory to return
export type CustomMapLabelOverlayConstructor = new (
  position: google.maps.LatLngLiteral,
  content: string,
  type: LabelType
) => ICustomMapLabelOverlay;


export function getCustomMapLabelOverlayClass(mapsApiInstance: typeof google.maps): CustomMapLabelOverlayConstructor {
  class CustomMapLabelOverlayInternal extends mapsApiInstance.OverlayView implements ICustomMapLabelOverlay {
    private mapsLatLng: typeof mapsApiInstance.LatLng;
    private positionLatLng: google.maps.LatLng;
    private content: string;
    private type: LabelType;
    private div: HTMLDivElement | null = null;
    private visible: boolean = true;

    constructor(position: google.maps.LatLngLiteral, content: string, type: LabelType) {
      super();
      this.mapsLatLng = mapsApiInstance.LatLng; 
      this.positionLatLng = new this.mapsLatLng(position.lat, position.lng);
      this.content = content;
      this.type = type;
    }

    private _applyStyles() {
      if (!this.div) return;

      // Common styles
      this.div.style.padding = '3px 6px'; // Reduced padding
      this.div.style.borderRadius = '6px'; // Slightly smaller radius
      this.div.style.textAlign = 'center';
      this.div.style.whiteSpace = 'pre-line'; 
      this.div.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
      this.div.style.zIndex = '101'; 
      this.div.style.transform = 'translateX(-50%) translateY(-100%) translateY(-12px)'; // Adjusted offset

      if (this.type === 'pickup') {
        this.div.style.background = 'rgb(22, 163, 74)'; // Green
        this.div.style.border = '1px solid rgba(255, 255, 255, 0.4)';
        this.div.style.color = '#FFFFFF';
        this.div.style.fontSize = '10px'; // Reduced font size
        this.div.style.fontWeight = '500';
      } else if (this.type === 'dropoff') { 
        this.div.style.background = 'rgb(220, 38, 38)'; // Red
        this.div.style.border = '1px solid rgba(255, 255, 255, 0.5)';
        this.div.style.color = '#FFFFFF';
        this.div.style.fontSize = '10px'; // Reduced font size
        this.div.style.fontWeight = '500';
      } else if (this.type === 'stop') {
        this.div.style.background = 'rgb(245, 158, 11)'; // Amber/Yellow (Tailwind amber-500)
        this.div.style.border = '1px solid rgba(0, 0, 0, 0.2)';
        this.div.style.color = '#000000'; // Black text for yellow background
        this.div.style.fontSize = '10px';
        this.div.style.fontWeight = '500';
      } else if (this.type === 'driver') {
        this.div.style.background = 'rgba(0, 0, 0, 0.75)'; 
        this.div.style.border = '1px solid rgba(255, 255, 255, 0.75)';
        this.div.style.color = '#FFFFFF';
        this.div.style.minWidth = '110px'; 
        this.div.style.fontSize = '11px'; // Kept driver font size slightly larger
        this.div.style.fontWeight = '600';
      }
    }

    onAdd() {
      this.div = document.createElement('div');
      this.div.style.position = 'absolute';
      this.div.style.pointerEvents = 'none'; 
      
      this._applyStyles(); 
      this.div.innerHTML = this.content;

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

    updateContent(newContent: string, newType: LabelType) {
      this.content = newContent;
      this.type = newType; 
      if (this.div) {
        this.div.innerHTML = this.content;
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
