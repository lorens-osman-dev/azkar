import Gtk from "gi://Gtk";

/** Mirror the whole row: GTK text direction does not inherit into child widgets. */
export function setRtlRow(widget: Gtk.Widget): void {
  widget.set_direction(Gtk.TextDirection.RTL);
  if (widget instanceof Gtk.Label) {
    // Gtk.Label mirrors xalign in RTL: 0 anchors the text at the right edge.
    widget.set_xalign(0);
    widget.set_justify(Gtk.Justification.RIGHT);
  }
  for (let child = widget.get_first_child(); child; child = child.get_next_sibling()) {
    setRtlRow(child);
  }
}
