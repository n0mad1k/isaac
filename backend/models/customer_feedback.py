"""
Customer Feedback Model
Allows users on production to submit feature requests/bug reports
that can be pulled into the dev tracker
"""

from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, Enum
from datetime import datetime
import enum

from .database import Base


class FeedbackType(enum.Enum):
    FEATURE = "feature"      # Feature request
    BUG = "bug"              # Bug report
    IMPROVEMENT = "improvement"  # Improvement suggestion
    OTHER = "other"          # Other feedback


class FeedbackStatus(enum.Enum):
    NEW = "new"              # Not yet reviewed
    APPROVED = "approved"    # Approved - added to dev tracker
    DECLINED = "declined"    # Declined - won't implement
    KICKBACK = "kickback"    # Needs more info from user
    PULLED = "pulled"        # Legacy: Pulled into dev tracker
    DISMISSED = "dismissed"  # Not actionable


class CustomerFeedback(Base):
    """Customer feedback/feature requests from production users"""
    __tablename__ = "customer_feedback"

    id = Column(Integer, primary_key=True, index=True)

    # Who submitted (optional - can be anonymous)
    submitted_by = Column(String(100), nullable=True)

    # Feedback content
    feedback_type = Column(Enum(FeedbackType), default=FeedbackType.FEATURE)
    title = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)

    # Status
    status = Column(Enum(FeedbackStatus), default=FeedbackStatus.NEW)

    # Admin response (for declined/kickback - shown to user)
    admin_response = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    pulled_at = Column(DateTime, nullable=True)  # When pulled to dev tracker
    reviewed_at = Column(DateTime, nullable=True)  # When admin reviewed

    def __repr__(self):
        return f"<CustomerFeedback {self.id}: {self.title}>"
