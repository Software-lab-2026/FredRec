from logging.config import fileConfig
from alembic import context
from app.core.db import get_sync_engine
from app.models import Base

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
# This line sets up loggers basically.
if config.config_file_name is not None:
    fileConfig(config.config_file_name, disable_existing_loggers=False)

# add your model's MetaData object here
# for 'autogenerate' support
# from myapp import mymodel
# target_metadata = mymodel.Base.metadata
# target_metadata = None

# other values from the config, defined by the needs of env.py,
# can be acquired:
# my_important_option = config.get_main_option("my_important_option")
# ... etc.


def run_migrations(connection) -> None:
    context.configure(connection=connection,
                      target_metadata=Base.metadata, compare_type=True, version_table_schema=config.attributes.get("version_table_schema"),
                      )
    with context.begin_transaction():
        context.run_migrations()


connection = config.attributes.get("connection")

if connection is not None:
    run_migrations(connection)
else:
    with get_sync_engine().connect() as connection:
        run_migrations(connection)
        connection.commit()
