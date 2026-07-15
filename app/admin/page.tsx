import { chatGPTSignInPath, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { getAdminAccess } from "@/app/admin-auth";
import AdminClient from "./admin-client";
import styles from "./admin.module.css";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const access = await getAdminAccess();

  if (!access.user) {
    return (
      <main className={styles.authPage}>
        <section className={styles.authCard}>
          <div className={styles.authMark}>E</div>
          <p className={styles.eyebrow}>Erika&apos;s Sweet 16</p>
          <h1>Invitation Studio</h1>
          <p>Sign in to manage guests, monitor responses, preview the invitation, and prepare event day.</p>
          <a className={styles.primaryButton} href={chatGPTSignInPath("/admin")}>Sign in with ChatGPT</a>
          <a className={styles.backLink} href="https://www.invitez.xyz">Return to invitation</a>
        </section>
      </main>
    );
  }

  if (!access.authorized) {
    return (
      <main className={styles.authPage}>
        <section className={styles.authCard}>
          <div className={styles.authMark}>!</div>
          <p className={styles.eyebrow}>Private dashboard</p>
          <h1>Access not available</h1>
          <p>This invitation dashboard belongs to a different account.</p>
          <a className={styles.primaryButton} href={chatGPTSignOutPath("/admin")}>Use another account</a>
        </section>
      </main>
    );
  }

  return (
    <AdminClient
      adminName={access.user.displayName}
      adminEmail={access.user.email}
      signOutPath={chatGPTSignOutPath("/admin")}
      localPreview={access.localPreview}
    />
  );
}
