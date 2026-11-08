const questions = [
  {
    question: "Can I see who doesn’t follow me back without logging in?",
    answer: "Yes. Once you have the two lists from Instagram, you can compare them here for free, without signing in or sharing your password.",
  },
  {
    question: "Is my Instagram data uploaded to a server?",
    answer: "Your browser reads and compares the files on your device. The comparison stays in this page’s memory until you clear it, refresh, or close the page.",
  },
  {
    question: "Does the tool work with private Instagram accounts?",
    answer: "Yes. The comparison works the same way for public and private profiles because it reads the lists you export from your own account.",
  },
  {
    question: "Why do I need two JSON files?",
    answer: "The following file tells the checker whom you follow. The follower files tell it who follows you. It needs both lists to find the difference.",
  },
  {
    question: "Are the results updated automatically?",
    answer: "The results are based on the files you select. To check again later, request a new Instagram export and compare the new files.",
  },
  {
    question: "Can I use the tool on mobile?",
    answer: "Yes. Unzip the Instagram export in your phone’s files app, then select the JSON files from your browser. You can also do this on a tablet or desktop.",
  },
];

export function FollowCheckerGuide() {
  return (
    <div className="mt-10 border-t border-border pt-8 pb-12 sm:mt-12 sm:pt-10 sm:pb-16">
      <div className="max-w-[68ch] space-y-8 text-sm leading-7 text-muted">
        <section aria-labelledby="what-it-does">
          <h2 id="what-it-does" className="text-xl font-semibold tracking-tight text-foreground">What is an Instagram Follow Checker?</h2>
          <p className="mt-2">
            Your followers are the accounts that follow you. Your following list contains the accounts you follow. This checker compares those two lists and shows the accounts on your following list that are missing from your followers list.
          </p>
        </section>

        <section aria-labelledby="how-to-compare">
          <h2 id="how-to-compare" className="text-xl font-semibold tracking-tight text-foreground">How to use the checker</h2>
          <ol className="mt-2 list-decimal space-y-1 ps-6 marker:font-medium marker:text-foreground">
            <li>Select <code translate="no">followers_1.json</code> under Followers. If the export has more numbered follower files, select them all together.</li>
            <li>Select <code translate="no">following.json</code> under Following. Use files from the same Instagram export.</li>
            <li>Choose <strong className="font-medium text-foreground">Compare</strong> to see who doesn’t follow you back. Search the results by username or open a profile in Instagram.</li>
          </ol>
        </section>

        <section aria-labelledby="download-instagram-data">
          <h2 id="download-instagram-data" className="scroll-mt-6 text-xl font-semibold tracking-tight text-foreground">How to download Instagram followers and following data</h2>
          <p className="mt-2">
            Open Instagram’s information export tool in Accounts Center and select your Instagram profile. Choose the followers and following information, select <strong className="font-medium text-foreground">JSON</strong> as the format, and use the full available date range. Request the export to your device.
          </p>
          <p className="mt-2">
            When the download is ready, unzip the archive and look for the followers and following JSON files. See{' '}
            <a href="https://help.instagram.com/181231772500920/" className="portfolio-text-link font-medium text-accent underline">Instagram’s official export instructions</a>.
          </p>
        </section>

        <section aria-labelledby="privacy-and-security">
          <h2 id="privacy-and-security" className="text-xl font-semibold tracking-tight text-foreground">Privacy and security</h2>
          <p className="mt-2">
            The checker runs in your browser and uses only the files you select. You can compare them without connecting your Instagram account. Use <strong className="font-medium text-foreground">Clear</strong> to remove the selected files and results from the page.
          </p>
        </section>

        <section aria-labelledby="results-limitations">
          <h2 id="results-limitations" className="text-xl font-semibold tracking-tight text-foreground">What the results mean</h2>
          <p className="mt-2">
            The export is a snapshot from the time Instagram prepared it. It shows which accounts appeared on each list at that point. An account missing from your followers list may never have followed you. To compare a more recent snapshot, request a fresh export.
          </p>
        </section>
      </div>

      <section aria-labelledby="follow-checker-faq" className="mt-9 border-t border-border pt-8">
        <h2 id="follow-checker-faq" className="text-xl font-semibold tracking-tight">Frequently asked questions</h2>
        <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {questions.map(({ question, answer }) => (
            <div key={question}>
              <h3 className="text-base font-medium tracking-tight">{question}</h3>
              <p className="mt-1 text-sm leading-6 text-muted">{answer}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
