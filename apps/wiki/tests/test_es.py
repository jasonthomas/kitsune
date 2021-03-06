import uuid

import elasticutils
from nose.tools import eq_

from sumo.tests import ElasticTestCase
from wiki.es_search import extract_document
from wiki.tests import document
from wiki.models import Document


class TestPostUpdate(ElasticTestCase):
    def test_add_and_delete(self):
        """Adding a doc should add it to the search index; deleting should
        delete it."""
        doc = document(save=True)
        self.refresh()
        eq_(elasticutils.S(Document).count(), 1)

        doc.delete()
        self.refresh()
        eq_(elasticutils.S(Document).count(), 0)

    def test_translations_get_parent_tags(self):
        doc1 = document(title=u'Audio too loud')
        doc1.save()
        doc1.tags.add(u'desktop')
        doc1.tags.add(u'windows')

        doc2 = document(title=u'Audio too loud bork bork',
                        parent=doc1)
        doc2.save()
        doc2.tags.add(u'badtag')

        # Verify the parent has the right tags.
        doc_dict = extract_document(doc1)
        eq_(doc_dict['tag'], [u'desktop', u'windows'])

        # Verify the translation has the parent's tags.
        doc_dict = extract_document(doc2)
        eq_(doc_dict['tag'], [u'desktop', u'windows'])
