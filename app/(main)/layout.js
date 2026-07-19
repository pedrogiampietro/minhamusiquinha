import { ClerkProvider, SignedIn, SignedOut, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import styles from "./main.module.css";

export default function MainLayout({ children }) {
  return (
    <ClerkProvider>
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <span className={styles.dot} /> Now Playing · Painel
          </div>
          <div className={styles.actions}>
            <SignedIn>
              <a className={styles.btn} href="/?settings=1">
                Configurações
              </a>
              <a className={`${styles.btn} ${styles.green}`} href="/?connect=1">
                + Conectar Spotify
              </a>
              <UserButton afterSignOutUrl="/sign-in" />
            </SignedIn>
            <SignedOut>
              <SignInButton mode="modal">
                <button className={styles.btn}>Entrar</button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className={`${styles.btn} ${styles.green}`}>Criar conta</button>
              </SignUpButton>
            </SignedOut>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </ClerkProvider>
  );
}
