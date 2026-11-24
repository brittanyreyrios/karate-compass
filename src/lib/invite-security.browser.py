"""Opt-in live signup verification, invoked by invite-security.integration.test.ts."""
import asyncio
import os
import sys
from pathlib import Path
from playwright.async_api import async_playwright


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context()
        page = await context.new_page()
        requests = []
        errors = []
        page.on("request", lambda req: requests.append(req.url))
        page.on("pageerror", lambda err: errors.append(str(err)))
        await page.goto("http://localhost:8080/auth", wait_until="networkidle")
        await page.get_by_role("tab", name="Sign up", exact=True).click()
        await page.get_by_label("Invite code", exact=True).fill(os.environ["INVITE_TEST_CODE"])
        await page.get_by_label("Family name", exact=True).fill("ZZ Test Invite Check")
        await page.get_by_label("Email", exact=True).fill(os.environ["INVITE_TEST_EMAIL"])
        await page.get_by_label("Password", exact=True).fill(os.environ["INVITE_TEST_PASSWORD"])
        await page.locator("#tos").click()
        await page.wait_for_timeout(700)
        assert not any("check_invite_code" in u for u in requests), "Lookup request remains"
        async with page.expect_response(lambda r: "/auth/v1/signup" in r.url) as response:
            await page.get_by_role("button", name="Create account", exact=True).click()
        result = await response.value
        expected = sys.argv[1]
        if expected == "accepted":
            assert result.status == 200, "Valid signup was refused"
            await page.get_by_role("heading", name="Check your email", exact=True).wait_for()
        else:
            assert result.status >= 400, "Bad invite signup accepted"
            await page.get_by_text(
                "We couldn't create your account just now. Please try again, or contact the front desk if it keeps happening.",
                exact=True,
            ).wait_for()
        screenshots = Path("/tmp/browser/invite")
        screenshots.mkdir(parents=True, exist_ok=True)
        await page.screenshot(path=str(screenshots / f"{expected}.png"))
        assert not errors, "Browser runtime error"
        if expected == "refused":
            await page.set_viewport_size({"width": 390, "height": 844})
            await page.screenshot(path=str(screenshots / "mobile.png"))
        print(expected + " signup verified; no invite lookup requests or runtime errors")
        await browser.close()


asyncio.run(main())