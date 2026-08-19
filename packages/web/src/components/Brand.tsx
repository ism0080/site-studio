import "./Brand.css";

export default function Brand() {
  return (
    <div data-component="brand">
      <span data-slot="mark">✳</span>
      <span data-slot="text">
        site<span data-slot="dot">.</span>studio
      </span>
    </div>
  );
}
