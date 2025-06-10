// src/components/ui/custom-map-label-overlay.ts

// This class is designed to work with the Google Maps JavaScript API.
// Ensure that the Google Maps API is loaded before attempting to use this class.

export class CustomMapLabelOverlay extends google.maps.OverlayView {
  private position: google.maps.LatLng;
  private content: string;
  private div: HTMLDivElement | null = null;
  private visible: boolean = true;

  constructor(position: google.maps.LatLngLiteral, content: string) {
    super();
    this.position = new google.maps.LatLng(position.lat, position.lng);
    this.content = content;
    // Ensure setMap is called on this instance after creation.
  }

  /**
   * onAdd is called when the map's panes are ready and the overlay has been
   * added to the map.
   */
  onAdd() {
    this.div = document.createElement('div');
    this.div.style.position = 'absolute';
    // Initial rough positioning - often fine-tuned in draw()
    // Moves the div up by its full height + a little extra (10px), and centers horizontally
    this.div.style.transform = 'translateX(-50%) translateY(-100%) translateY(-12px)'; 
    
    // Styling for the pill-shaped label
    this.div.style.background = 'hsl(var(--destructive))'; 
    this.div.style.color = 'hsl(var(--destructive-foreground))'; 
    this.div.style.padding = '6px 10px'; // Slightly smaller padding
    this.div.style.borderRadius = '16px';
    this.div.style.fontSize = '13px'; // Slightly larger font
    this.div.style.fontWeight = '600'; // Semi-bold
    this.div.style.textAlign = 'center';
    this.div.style.whiteSpace = 'pre-line'; // Respects newlines in the content string
    this.div.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    this.div.style.pointerEvents = 'none'; // Important: Allows map interactions underneath
    this.div.style.zIndex = '101'; // Higher z-index
    this.div.style.border = '1px solid hsl(var(--destructive-foreground) / 0.5)'; // Optional subtle border


    this.div.innerHTML = this.content;

    // Add the element to the "floatPane" so it sits on top of markers.
    const panes = this.getPanes();
    if (panes) {
      panes.floatPane.appendChild(this.div);
    }
  }

  /**
   * draw is called when the overlay is set on the map and whenever the map
   * is zoomed or panned.
   */
  draw() {
    const projection = this.getProjection();

    // Ensure projection and div are available.
    if (!projection || !this.div) {
      return;
    }

    const sw = projection.fromLatLngToDivPixel(this.position);

    if (sw) {
      this.div.style.left = `${sw.x}px`;
      this.div.style.top = `${sw.y}px`;
    }
    
    this.div.style.visibility = this.visible ? 'visible' : 'hidden';
  }

  /**
   * onRemove is called when the overlay is removed from the map.
   */
  onRemove() {
    if (this.div && this.div.parentNode) {
      this.div.parentNode.removeChild(this.div);
      this.div = null;
    }
  }

  // --- Custom methods to manage the overlay ---
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
      // Potentially re-draw if content size changes significantly, though draw() should handle position.
    }
  }

  updatePosition(newPosition: google.maps.LatLngLiteral) {
    this.position = new google.maps.LatLng(newPosition.lat, newPosition.lng);
    this.draw(); // Redraw to update the position on the map.
  }
}
