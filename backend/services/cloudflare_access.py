"""
Cloudflare Access Service
Manages user email access in Cloudflare Access policies
"""

import aiohttp
from loguru import logger
from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession


class CloudflareAccessService:
    """Service to manage Cloudflare Access policies for user invitations"""

    BASE_URL = "https://api.cloudflare.com/client/v4"

    def __init__(self, api_token: str, account_id: str, app_id: str):
        self.api_token = api_token
        self.account_id = account_id
        self.app_id = app_id
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json"
        }

    @classmethod
    async def get_configured_service(cls, db: AsyncSession) -> Optional["CloudflareAccessService"]:
        """Get a configured CloudflareAccessService from database settings"""
        from routers.settings import get_setting

        api_token = await get_setting(db, "cloudflare_api_token")
        account_id = await get_setting(db, "cloudflare_account_id")
        app_id = await get_setting(db, "cloudflare_app_id")

        if not all([api_token, account_id, app_id]):
            logger.debug("Cloudflare Access not configured - missing settings")
            return None

        return cls(api_token, account_id, app_id)

    async def get_app_policies(self) -> Optional[List[dict]]:
        """Get all policies for the configured application"""
        url = f"{self.BASE_URL}/accounts/{self.account_id}/access/apps/{self.app_id}/policies"

        async with aiohttp.ClientSession() as session:
            async with session.get(url, headers=self.headers) as response:
                if response.status != 200:
                    error = await response.text()
                    logger.error(f"Failed to get CF policies: {error}")
                    return None

                data = await response.json()
                if not data.get("success"):
                    logger.error(f"CF API error: {data.get('errors')}")
                    return None

                return data.get("result", [])

    async def get_policy_emails(self, policy_id: str) -> Optional[List[str]]:
        """Get list of emails from a policy's include rules"""
        policies = await self.get_app_policies()
        if not policies:
            return None

        for policy in policies:
            if policy.get("id") == policy_id:
                for rule in policy.get("include", []):
                    if "email" in rule:
                        email_str = rule["email"].get("email", "")
                        # Emails are stored as comma-separated string
                        return [e.strip() for e in email_str.split(",") if e.strip()]

        return None

    async def add_email_to_policy(self, email: str, policy_id: str = None) -> bool:
        """Add an email to the access policy

        Args:
            email: Email address to add
            policy_id: Specific policy ID (if None, uses first policy found)
        """
        # Get current policies
        policies = await self.get_app_policies()
        if not policies:
            logger.error("No policies found for CF app")
            return False

        # Find the target policy
        target_policy = None
        if policy_id:
            for p in policies:
                if p.get("id") == policy_id:
                    target_policy = p
                    break
        else:
            # Use the first policy (usually "Allow" policy)
            target_policy = policies[0] if policies else None

        if not target_policy:
            logger.error(f"Policy not found: {policy_id}")
            return False

        policy_id = target_policy["id"]

        # Get current emails from ALL include rules (each email should be its own rule)
        current_emails = []
        include_rules = target_policy.get("include", [])
        non_email_rules = []

        for rule in include_rules:
            if "email" in rule:
                # Handle both single email and comma-separated (legacy format)
                email_str = rule["email"].get("email", "")
                for e in email_str.split(","):
                    e = e.strip()
                    if e and e.lower() not in [x.lower() for x in current_emails]:
                        current_emails.append(e)
            else:
                non_email_rules.append(rule)

        # Check if email already exists
        if email.lower() in [e.lower() for e in current_emails]:
            logger.info(f"Email {email} already in CF policy")
            return True

        # Add the new email
        current_emails.append(email)

        # Build new include rules - each email as separate rule (correct Cloudflare format)
        new_include_rules = non_email_rules + [{"email": {"email": e}} for e in current_emails]

        # Update the policy - try app-specific endpoint first, then reusable policy endpoint
        update_data = {
            "name": target_policy.get("name", "Allow"),
            "decision": target_policy.get("decision", "allow"),
            "include": new_include_rules,
            "exclude": target_policy.get("exclude", []),
            "require": target_policy.get("require", []),
        }

        # Try both endpoints - app-specific and reusable policy
        endpoints = [
            f"{self.BASE_URL}/accounts/{self.account_id}/access/apps/{self.app_id}/policies/{policy_id}",
            f"{self.BASE_URL}/accounts/{self.account_id}/access/policies/{policy_id}",
        ]

        async with aiohttp.ClientSession() as session:
            for url in endpoints:
                async with session.put(url, headers=self.headers, json=update_data) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get("success"):
                            logger.info(f"Added {email} to Cloudflare Access policy")
                            return True

                    error = await response.text()
                    # If it's a reusable policy error, try the next endpoint
                    if "reusable policies" in error.lower():
                        logger.debug(f"Policy is reusable, trying alternate endpoint")
                        continue

                    logger.error(f"Failed to update CF policy: {error}")

            return False

    async def remove_email_from_policy(self, email: str, policy_id: str = None) -> bool:
        """Remove an email from the access policy

        Args:
            email: Email address to remove
            policy_id: Specific policy ID (if None, uses first policy found)
        """
        # Get current policies
        policies = await self.get_app_policies()
        if not policies:
            return False

        # Find the target policy
        target_policy = None
        if policy_id:
            for p in policies:
                if p.get("id") == policy_id:
                    target_policy = p
                    break
        else:
            target_policy = policies[0] if policies else None

        if not target_policy:
            return False

        policy_id = target_policy["id"]

        # Get current emails from ALL include rules (each email should be its own rule)
        current_emails = []
        include_rules = target_policy.get("include", [])
        non_email_rules = []

        for rule in include_rules:
            if "email" in rule:
                # Handle both single email and comma-separated (legacy format)
                email_str = rule["email"].get("email", "")
                for e in email_str.split(","):
                    e = e.strip()
                    if e and e.lower() not in [x.lower() for x in current_emails]:
                        current_emails.append(e)
            else:
                non_email_rules.append(rule)

        # Remove the email (case-insensitive)
        new_emails = [e for e in current_emails if e.lower() != email.lower()]

        if len(new_emails) == len(current_emails):
            logger.info(f"Email {email} not found in CF policy")
            return True  # Already not there

        # Build new include rules - each email as separate rule (correct Cloudflare format)
        new_include_rules = non_email_rules + [{"email": {"email": e}} for e in new_emails]

        # Update the policy - try app-specific endpoint first, then reusable policy endpoint
        update_data = {
            "name": target_policy.get("name", "Allow"),
            "decision": target_policy.get("decision", "allow"),
            "include": new_include_rules,
            "exclude": target_policy.get("exclude", []),
            "require": target_policy.get("require", []),
        }

        # Try both endpoints - app-specific and reusable policy
        endpoints = [
            f"{self.BASE_URL}/accounts/{self.account_id}/access/apps/{self.app_id}/policies/{policy_id}",
            f"{self.BASE_URL}/accounts/{self.account_id}/access/policies/{policy_id}",
        ]

        async with aiohttp.ClientSession() as session:
            for url in endpoints:
                async with session.put(url, headers=self.headers, json=update_data) as response:
                    if response.status == 200:
                        data = await response.json()
                        if data.get("success"):
                            logger.info(f"Removed {email} from Cloudflare Access policy")
                            return True

                    error = await response.text()
                    # If it's a reusable policy error, try the next endpoint
                    if "reusable policies" in error.lower():
                        logger.debug(f"Policy is reusable, trying alternate endpoint")
                        continue

                    logger.error(f"Failed to update CF policy: {error}")

            return False


async def add_email_to_cloudflare_access(db: AsyncSession, email: str) -> bool:
    """Convenience function to add an email to Cloudflare Access

    Returns True if successful or if CF is not configured (graceful skip)
    """
    service = await CloudflareAccessService.get_configured_service(db)
    if not service:
        logger.debug("Cloudflare Access not configured, skipping")
        return True  # Not an error - just not configured

    return await service.add_email_to_policy(email)


async def remove_email_from_cloudflare_access(db: AsyncSession, email: str) -> bool:
    """Convenience function to remove an email from Cloudflare Access

    Returns True if successful or if CF is not configured (graceful skip)
    """
    service = await CloudflareAccessService.get_configured_service(db)
    if not service:
        return True

    return await service.remove_email_from_policy(email)
