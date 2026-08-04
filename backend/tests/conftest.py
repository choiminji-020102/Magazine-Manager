"""페이징 정렬 회귀 테스트용 공용 픽스처.

SQLite in-memory 를 쓰는 이유:
- 운영 MySQL 에 테스트 데이터를 넣지 않기 위함
- 이 테스트의 목적은 "생성되는 ORDER BY 절에 PK 2차 정렬키가 있는가" 와
  "페이지 순회가 전체를 빠짐없이 덮는가" 이며, 둘 다 방언 의존성이 없음

한계: MySQL 의 tie 비결정성 자체는 SQLite 로 재현되지 않는다.
따라서 데이터 기반 테스트만으로는 회귀를 못 잡을 수 있어,
SQL 구조 검증(test_list_queries_have_pk_tiebreak)을 함께 둔다.
"""
import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker

from app.db.base import Base

# 모델을 import 해야 Base.metadata 에 테이블이 등록된다
import app.models.activity_log  # noqa: F401
import app.models.address  # noqa: F401
import app.models.admin  # noqa: F401
import app.models.customer  # noqa: F401
import app.models.inquiry  # noqa: F401
import app.models.order  # noqa: F401
import app.models.order_item  # noqa: F401
import app.models.pause  # noqa: F401
import app.models.product  # noqa: F401
import app.models.send  # noqa: F401
import app.models.send_item  # noqa: F401


@pytest.fixture
def engine():
    eng = create_engine("sqlite://")
    Base.metadata.create_all(eng)
    return eng


@pytest.fixture
def db(engine):
    session = sessionmaker(bind=engine)()
    yield session
    session.close()


@pytest.fixture
def captured_sql(engine):
    """실행된 SQL 문을 순서대로 수집한다 (ORDER BY 절 검증용)."""
    statements = []

    @event.listens_for(engine, "before_cursor_execute")
    def _capture(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    return statements
