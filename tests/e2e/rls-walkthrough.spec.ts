import { test, expect } from '@playwright/test'

// The README's "Try it in 60 seconds" walkthrough, automated: two browser
// contexts = two windows with isolated storage (the incognito instruction).
// Targets the LIVE deployment by default (see playwright.config.ts) — redeploy
// with `vercel --prod` after UI changes before running.
const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
const leadA = `Lead from A ${runId}`
const leadB = `Lead from B ${runId}`

async function signIn(page: import('@playwright/test').Page, user: string) {
  await page.getByRole('button', { name: user }).click()
  // The submit button is role=button; the tab has role=tab, so this matches
  // exactly the submit control.
  await page.getByRole('button', { name: 'Sign in' }).click()
  // Supabase normalizes emails to lowercase, so the chip shows
  // usera@test.com — match case-insensitively. Generous timeout: cold
  // Supabase auth can take seconds.
  await expect(page.getByTitle('Signed-in user')).toHaveText(new RegExp(user, 'i'), {
    timeout: 15_000,
  })
}

async function addLead(page: import('@playwright/test').Page, name: string) {
  await page.getByLabel('Lead name').fill(name)
  await page.getByRole('button', { name: 'Add lead' }).click()
  await expect(page.getByText(name)).toBeVisible()
}

async function deleteOwnLead(page: import('@playwright/test').Page, name: string) {
  await page.getByRole('button', { name: `Delete ${name}` }).click()
  await page.getByRole('button', { name: `Confirm delete ${name}` }).click()
  await expect(page.getByText(name)).toHaveCount(0)
}

test('README walkthrough: two users, one policy, isolated rows', async ({
  browser,
}) => {
  const contextA = await browser.newContext()
  const contextB = await browser.newContext()
  const pageA = await contextA.newPage()
  const pageB = await contextB.newPage()

  await test.step('A signs in and adds a lead', async () => {
    try {
      await pageA.goto('/')
    } catch {
      throw new Error(
        'Live site or Supabase unreachable. If the free-tier project is paused, wake it in the Supabase dashboard and re-run.'
      )
    }
    await signIn(pageA, 'userA@test.com')
    await addLead(pageA, leadA)
  })

  await test.step('B sees none of it, adds their own', async () => {
    await pageB.goto('/')
    await signIn(pageB, 'userB@test.com')
    await expect(pageB.getByText(leadA)).toHaveCount(0)
    await addLead(pageB, leadB)
    await expect(pageB.getByText(leadA)).toHaveCount(0)
  })

  await test.step('A reloads, still blind to B, deletes only their own', async () => {
    await pageA.reload()
    await expect(pageA.getByText(leadB)).toHaveCount(0)
    await deleteOwnLead(pageA, leadA)
    expect(await pageA.getByTitle('Signed-in user').textContent()).toMatch(
      /userA@test\.com/i
    )
  })

  await test.step('B cleans up their own lead', async () => {
    await deleteOwnLead(pageB, leadB)
  })

  await contextA.close()
  await contextB.close()
})
