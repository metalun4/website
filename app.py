from flask import Flask, render_template
from datetime import datetime

import config


app = Flask(__name__)


@app.route('/')
def index():
    return render_template(
        "index.html",
        **{
            "title": 'Home',
            "me": config.me,
            "social": config.social_metadata,
            "year": datetime.now().year
        },
    )


@app.context_processor
def checkers():
    def main_metadata(value):
        return config.main_metadata[value]

    def social_metadata(name):
        return config.social_metadata[name]

    return dict(main_metadata=main_metadata, social_metadata=social_metadata)


if __name__ == '__main__':
    app.run(host=config.host, port=config.port)
