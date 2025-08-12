import "@/styles/globals.css";
import Providers from "@/components/Providers";
import Header from "@/components/Header";

export default function App({ Component, pageProps }) {
  return (
    <Providers>
      <Header />
      <Component {...pageProps} />
    </Providers>
  );
}