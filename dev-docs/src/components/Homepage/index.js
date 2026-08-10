import clsx from "clsx";
import React from "react";

import styles from "./styles.module.css";

const FeatureList = [
  {
    title: "Learn how Pomai Whiteboard works",
    Svg: require("@site/static/img/undraw_innovative.svg").default,
    description: (
      <>Want to contribute to Pomai Whiteboard but got lost in the codebase?</>
    ),
  },
  {
    title: "Integrate Pomai Whiteboard",
    Svg: require("@site/static/img/undraw_blank_canvas.svg").default,
    description: (
      <>
        Want to build your own app powered by Pomai Whiteboard but don't know where to
        start?
      </>
    ),
  },
  {
    title: "Help us improve",
    Svg: require("@site/static/img/undraw_add_files.svg").default,
    description: (
      <>
        Are the docs missing something? Anything you had trouble understanding
        or needs an explanation? Come contribute to the docs to make them even
        better!
      </>
    ),
  },
];

function Feature({ Svg, title, description }) {
  return (
    <div className={clsx("col col--4")}>
      <div className="text--center">
        <Svg className={styles.featureSvg} role="img" />
      </div>
      <div className="text--center padding-horiz--md">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

export default function HomepageFeatures() {
  return (
    <section className={styles.features}>
      <div className="container">
        <div className="row">
          {FeatureList.map((props, idx) => (
            <Feature key={idx} {...props} />
          ))}
        </div>
      </div>
    </section>
  );
}
