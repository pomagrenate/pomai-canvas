import "./PomaiLogo.scss";

const LogoIcon = () => (
  <img
    src="/pomaiwhiteboard.png"
    alt="Pomai Whiteboard"
    className="PomaiLogo-icon"
    style={{ objectFit: "contain" }}
  />
);

const LogoText = () => (
  <svg
    viewBox="0 0 450 50"
    xmlns="http://www.w3.org/2000/svg"
    className="PomaiLogo-text"
  >
    <text
      x="0"
      y="38"
      fill="currentColor"
      fontFamily="Excalifont, Xiaolai, sans-serif"
      fontSize="40"
      fontWeight="bold"
      letterSpacing="2"
    >
      POMAI WHITEBOARD
    </text>
  </svg>
);

type LogoSize = "xs" | "small" | "normal" | "large" | "custom" | "mobile";

interface LogoProps {
  size?: LogoSize;
  withText?: boolean;
  style?: React.CSSProperties;
  /**
   * If true, the logo will not be wrapped in a Link component.
   * The link prop will be ignored as well.
   * It will merely be a plain div.
   */
  isNotLink?: boolean;
}

export const PomaiLogo = ({
  style,
  size = "small",
  withText,
}: LogoProps) => {
  return (
    <div className={`PomaiLogo is-${size}`} style={style}>
      <LogoIcon />
      {withText && <LogoText />}
    </div>
  );
};

/** @deprecated Use PomaiLogo instead */
export const ExcalidrawLogo = PomaiLogo;
