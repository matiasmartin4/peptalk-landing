/* peptalk — landing. */
import { Drawer } from "./components/Drawer";
import { Hero } from "./components/Hero";
import { Library } from "./components/Library";
import { Nav } from "./components/Nav";
import { Footer, Guides, Method, News, Referral, States } from "./components/Sections";
import { Systems } from "./components/Systems";
import { StoreProvider } from "./lib/store";

export function App() {
  return (
    <StoreProvider>
      <a className="skip" href="#main">Saltar al contenido</a>
      <Nav />
      <main id="main">
        <Hero />
        <Systems />
        <Library />
        <States />
        <News />
        <Referral />
        <Guides />
        <Method />
      </main>
      <Footer />
      <Drawer />
    </StoreProvider>
  );
}
