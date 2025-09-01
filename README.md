# Chromodynamic Fog

Hack of the original Dynamic Fog extension that adds colored lights and the ability to restrict lights to specific players.

- **Colored Lights**: If a light's color is black (the default), it will act as a regular Dynamic Fog light. If the color is anything else, it will add a glow effect in the selected color.
  - **Primary** lights (with a person icon) will use a more processor-intensive visibility calculation which allows the light to update while it's being moved. **Secondary** (campfire icon) lights use a more performant calculation that doesn't update while the light is moved.
- **Per player lights**: If you set the 'owner only' field to owner only (the single person icon), then only the token owner and the GM will be able to see the light.

- Bugs:
  - Primary lights don't update while rotating

## License

GNU GPLv3
