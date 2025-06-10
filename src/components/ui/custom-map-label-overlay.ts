
// This will be a factory function to create the class
// It expects the fully loaded 'google.maps' object as an argument.

// Forward declare to satisfy TypeScript before google global is ready
// This helps TypeScript understand the types even if 'google' isn't globally defined at parse time.
declare global {
  interface Window {
    google: typeof google;
  }
}

// Define an interface for the instance methods we expect
export interface ICustomMapLabelOverlay extends google.maps.OverlayView {
  updatePosition(position: google.maps.LatLngLiteral): void;
  updateContent(content: string): void;
  show(): void;
  hide(): void;
  // setMap(map: google.maps.Map | null): void; // Already part of OverlayView from google.maps.d.ts
}

// Define a type for the constructor we expect our factory to return
export type CustomMapLabelOverlayConstructor = new (
  position: google.maps.LatLngLiteral,
  content: string
) => ICustomMapLabelOverlay;


export function getCustomMapLabelOverlayClass(mapsApiInstance: typeof google.maps): CustomMapLabelOverlayConstructor {
  class CustomMapLabelOverlayInternal extends mapsApiInstance.OverlayView implements ICustomMapLabelOverlay {
    private mapsLatLng: typeof mapsApiInstance.LatLng;
    private positionLatLng: google.maps.LatLng;
    private content: string;
    private div: HTMLDivElement | null = null;
    private visible: boolean = true;

    constructor(position: google.maps.LatLngLiteral, content: string) {
      super();
      this.mapsLatLng = mapsApiInstance.LatLng; // Store constructor for LatLng
      this.positionLatLng = new this.mapsLatLng(position.lat, position.lng);
      this.content = content;
    }

    onAdd() {
      this.div = document.createElement('div');
      this.div.style.position = 'absolute';
      this.div.style.transform = 'translateX(-50%) translateY(-100%) translateY(-12px)';
      this.div.style.background = 'rgb(22, 163, 74)'; // Changed to Green
      this.div.style.color = '#FFFFFF'; // Changed to White
      this.div.style.padding = '6px 10px';
      this.div.style.borderRadius = '16px';
      this.div.style.fontSize = '13px';
      this.div.style.fontWeight = '600';
      this.div.style.textAlign = 'center';
      this.div.style.whiteSpace = 'pre-line';
      this.div.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
      this.div.style.pointerEvents = 'none'; 
      this.div.style.zIndex = '101'; 
      this.div.style.border = '1px solid rgba(255, 255, 255, 0.5)'; // Changed to white border
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

    updateContent(newContent: string) {
      this.content = newContent;
      if (this.div) {
        this.div.innerHTML = this.content;
      }
    }

    updatePosition(newPosition: google.maps.LatLngLiteral) {
      this.positionLatLng = new this.mapsLatLng(newPosition.lat, newPosition.lng);
      this.draw();
    }
  }
  return CustomMapLabelOverlayInternal;
}
